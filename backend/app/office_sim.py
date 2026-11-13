import asyncio
import heapq
import math
import random
import time
from dataclasses import dataclass, field
from fastapi import WebSocket

from .agents import AGENTS, AgentProfile
from .config import settings
from .llm_router import generate_agent_reply

GRID_W = 16
GRID_H = 13

# Blocked cells: desks, conference table, coffee bar, server rack
BLOCKED_CELLS: set[tuple[int, int]] = {
    # Left desks (x=1, y=2,6,10)
    (1, 2), (1, 3), (1, 6), (1, 7), (1, 10), (1, 11),
    # Right desks (x=14, y=2,8)
    (14, 2), (14, 3), (14, 8), (14, 9),
    # Conference table center (x=8, y=5)
    (8, 5),
    # Coffee lounge (top middle)
    (7, 1), (8, 1), (9, 1),
    # Server rack (bottom middle)
    (7, 11), (8, 11),
}

CONFERENCE_CENTER = (8, 5)
LOUNGE_SPOTS: list[tuple[int, int]] = [(6, 2), (10, 2), (6, 9), (10, 9), (5, 5), (11, 5)]
COFFEE_SPOTS: list[tuple[int, int]] = [(7, 2), (8, 2), (9, 2)]
SERVER_SPOTS: list[tuple[int, int]] = [(7, 10), (8, 10)]

# Adjacent visitor spot next to each specialist's desk for peer reviews & idle visits
COLLAB_VISIT_POS: dict[str, tuple[int, int]] = {
    "lead": (3, 2),
    "cybersec": (3, 6),
    "dev": (3, 10),
    "growth": (12, 2),
    "motion": (12, 8),
}

DESK_CELLS: set[tuple[int, int]] = {prof.desk_pos for prof in AGENTS.values()}
DESK_FACING: dict[str, tuple[float, float]] = {
    aid: (-1.0, 0.0) if prof.desk_pos[0] < 7 else (1.0, 0.0)
    for aid, prof in AGENTS.items()
}

# Zero-token idle flavor lines (used during Economy Mode and silent idle routines)
COFFEE_PHRASES = [
    "Завариваю крепкий эспрессо…",
    "Короткий кофе-брейк перед рывком.",
    "Без кофе нейросети думают медленнее.",
    "Беру стаканчик и возвращаюсь за код.",
]
SERVER_PHRASES = [
    "Проверяю логи и температуру стоек.",
    "Мониторю аптайм и задержки API.",
    "Смотрю загрузку локальных воркеров.",
]
LOUNGE_PHRASES = [
    "Разминаюсь и обдумываю архитектуру.",
    "Переключаю контекст на пару минут.",
    "Прикидываю план на следующий спринт.",
]


def _direction_yaw(fx: float, fy: float) -> float:
    """Convert grid direction (dx, dy) to Three.js Y-axis yaw atan2(dx, dz)."""
    if abs(fx) < 1e-6 and abs(fy) < 1e-6:
        return 0.0
    return math.atan2(fx, fy)


def _angle_diff(a: float, b: float) -> float:
    return abs((a - b + math.pi) % (2.0 * math.pi) - math.pi)


def _normalize_vec(fx: float, fy: float) -> tuple[float, float]:
    length = math.hypot(fx, fy)
    if length < 1e-6:
        return (0.0, 0.0)
    return (fx / length, fy / length)


def astar(
    start: tuple[int, int],
    goal: tuple[int, int],
    blocked_extra: set[tuple[int, int]] | None = None,
) -> list[tuple[int, int]]:
    if start == goal:
        return []
    extra = blocked_extra or set()
    open_heap: list[tuple[int, int, tuple[int, int]]] = [(0, 0, start)]
    came_from: dict[tuple[int, int], tuple[int, int]] = {}
    g_score: dict[tuple[int, int], int] = {start: 0}
    counter = 0

    while open_heap:
        _, _, current = heapq.heappop(open_heap)
        if current == goal:
            path = []
            while current in came_from:
                path.append(current)
                current = came_from[current]
            path.reverse()
            return path

        cx, cy = current
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = cx + dx, cy + dy
            if not (0 <= nx < GRID_W and 0 <= ny < GRID_H):
                continue
            nxt = (nx, ny)
            if nxt != goal and (nxt in BLOCKED_CELLS or nxt in extra):
                continue
            # Prefer walking through the main office floor rather than behind desks/walls
            step_cost = 3 if (nx in (0, GRID_W - 1) or ny in (0, GRID_H - 1)) else 1
            tentative_g = g_score[current] + step_cost
            if tentative_g < g_score.get(nxt, 10**9):
                came_from[nxt] = current
                g_score[nxt] = tentative_g
                h = abs(goal[0] - nx) + abs(goal[1] - ny)
                counter += 1
                heapq.heappush(open_heap, (tentative_g + h, counter, nxt))
    return []


@dataclass
class IdleStep:
    gx: int
    gy: int
    face_dir: tuple[float, float]
    wait_sec: float = 4.0
    bubble: str = ""
    category: str = "lounge"


@dataclass
class AgentState:
    profile: AgentProfile
    x: float
    y: float
    target_x: int
    target_y: int
    path: list[tuple[int, int]] = field(default_factory=list)
    status: str = "idle"  # idle | walking | meeting | working
    bubble: str = ""
    bubble_until: float = 0.0
    collaborating_with: str = ""
    facing: float = 0.0
    _post_walk_status: str = "idle"
    _target_face_dir: tuple[float, float] | None = None
    _did_turn_nudge: bool = False
    _wait_ticks: int = 0
    idle_steps: list[IdleStep] = field(default_factory=list)
    idle_wait_until: float = 0.0
    _pending_wait_sec: float = 0.0
    _pending_bubble: str = ""

    def to_dict(self) -> dict:
        now = time.time()
        return {
            "id": self.profile.id,
            "name": self.profile.name,
            "role": self.profile.role,
            "specialty": self.profile.specialty,
            "color": self.profile.color,
            "provider": self.profile.provider,
            "model": self.profile.model,
            "x": round(self.x, 3),
            "y": round(self.y, 3),
            "facing": round(self.facing, 3),
            "status": self.status,
            "bubble": self.bubble if now < self.bubble_until else "",
            "collaborating_with": self.collaborating_with,
        }


class OfficeSimulation:
    def __init__(self) -> None:
        self.agents: dict[str, AgentState] = {}
        for aid, prof in AGENTS.items():
            dx, dy = prof.desk_pos
            fx, fy = DESK_FACING[aid]
            self.agents[aid] = AgentState(
                profile=prof,
                x=float(dx),
                y=float(dy),
                target_x=dx,
                target_y=dy,
                facing=_direction_yaw(fx, fy),
            )
        self.clients: set[WebSocket] = set()
        self.messages: list[dict] = []
        self.task_running: bool = False
        self.current_task: str = ""
        self._active_task_handle: asyncio.Task | None = None
        self._last_idle_chat: float = 0.0
        self._last_wander: float = 0.0
        self._next_wander_delay: float = 6.0

    def set_bubble(self, agent_id: str, text: str, duration: float = 9.0) -> None:
        st = self.agents[agent_id]
        st.bubble = text[:120] + ("…" if len(text) > 120 else "")
        st.bubble_until = time.time() + duration

    def _reserved_targets(self, exclude_id: str | None = None) -> set[tuple[int, int]]:
        """All grid tiles currently claimed as a destination or occupied by stationary agents."""
        reserved: set[tuple[int, int]] = set()
        for aid, st in self.agents.items():
            if aid == exclude_id:
                continue
            reserved.add((st.target_x, st.target_y))
            if not st.path:
                reserved.add((round(st.x), round(st.y)))
        return reserved

    def _occupied_tiles(self, exclude_id: str | None = None) -> set[tuple[int, int]]:
        return {
            (round(st.x), round(st.y))
            for aid, st in self.agents.items()
            if aid != exclude_id
        }

    def _is_tile_available_for(self, agent_id: str, pos: tuple[int, int]) -> bool:
        gx, gy = pos
        if not (0 <= gx < GRID_W and 0 <= gy < GRID_H):
            return False
        if pos in BLOCKED_CELLS:
            return False
        # Never park on another agent's personal desk chair
        if pos in DESK_CELLS and pos != self.agents[agent_id].profile.desk_pos:
            return False
        return pos not in self._reserved_targets(exclude_id=agent_id)

    def _nearest_free_tile(self, agent_id: str, desired: tuple[int, int]) -> tuple[int, int]:
        if self._is_tile_available_for(agent_id, desired):
            return desired
        seen = {desired}
        queue = [desired]
        while queue:
            cx, cy = queue.pop(0)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nxt = (cx + dx, cy + dy)
                if nxt in seen:
                    continue
                if not (0 <= nxt[0] < GRID_W and 0 <= nxt[1] < GRID_H):
                    continue
                seen.add(nxt)
                if self._is_tile_available_for(agent_id, nxt):
                    return nxt
                if nxt not in BLOCKED_CELLS:
                    queue.append(nxt)
        return self.agents[agent_id].profile.desk_pos

    def _default_face_for(self, agent_id: str, gx: int, gy: int) -> tuple[float, float] | None:
        prof = self.agents[agent_id].profile
        if (gx, gy) == prof.desk_pos:
            return DESK_FACING[agent_id]
        if (gx, gy) == prof.meeting_pos:
            return (float(CONFERENCE_CENTER[0] - gx), float(CONFERENCE_CENTER[1] - gy))
        if (gx, gy) in COFFEE_SPOTS:
            return (0.0, -1.0)
        if (gx, gy) in SERVER_SPOTS:
            return (0.0, 1.0)
        for tid, pos in COLLAB_VISIT_POS.items():
            if (gx, gy) == pos:
                tdx, tdy = self.agents[tid].profile.desk_pos
                return (float(tdx - gx), float(tdy - gy))
        return None

    def _plan_path(
        self,
        agent_id: str,
        start: tuple[int, int],
        goal: tuple[int, int],
        face_dir: tuple[float, float] | None,
        extra_blocked: set[tuple[int, int]] | None = None,
    ) -> list[tuple[int, int]]:
        if start == goal:
            return []
        stationary_others = {
            (round(st.x), round(st.y))
            for aid, st in self.agents.items()
            if aid != agent_id and not st.path
        }
        blocked = stationary_others | (extra_blocked or set())

        direct = astar(start, goal, blocked)
        if not direct:
            # Retry without soft stationary blocks in case another agent is mid-transition
            direct = astar(start, goal, extra_blocked)
        if not direct or not face_dir:
            return direct

        # If facing is cardinal, try approaching from the cell behind the desired facing
        # so the avatar naturally walks in facing the desk / coffee machine / colleague.
        ux, uy = _normalize_vec(*face_dir)
        if abs(abs(ux) - 1.0) < 0.15 or abs(abs(uy) - 1.0) < 0.15:
            ax, ay = goal[0] - round(ux), goal[1] - round(uy)
            approach = (ax, ay)
            if (
                approach != start
                and approach != goal
                and 0 <= ax < GRID_W
                and 0 <= ay < GRID_H
                and approach not in BLOCKED_CELLS
                and approach not in blocked
                and (approach not in DESK_CELLS or approach == self.agents[agent_id].profile.desk_pos)
            ):
                p_app = astar(start, approach, blocked | {goal})
                if p_app and len(p_app) + 1 <= len(direct) + 2:
                    return p_app + [goal]
        return direct

    def _evict_if_reserved(self, pos: tuple[int, int], incoming_id: str) -> None:
        """If an idle agent is holding a tile needed for a task, move them back to their desk."""
        for aid, st in self.agents.items():
            if aid == incoming_id:
                continue
            cur = (round(st.x), round(st.y))
            if (st.target_x, st.target_y) == pos or (not st.path and cur == pos):
                st.idle_steps.clear()
                st.idle_wait_until = 0.0
                dx, dy = st.profile.desk_pos
                if (dx, dy) != pos:
                    self._assign_move(aid, dx, dy, "idle", DESK_FACING[aid])

    def _assign_move(
        self,
        agent_id: str,
        gx: int,
        gy: int,
        next_status: str,
        face_dir: tuple[float, float] | None,
    ) -> None:
        st = self.agents[agent_id]
        sx, sy = round(st.x), round(st.y)
        st.target_x = gx
        st.target_y = gy
        st._post_walk_status = next_status
        st._target_face_dir = face_dir if face_dir is not None else self._default_face_for(agent_id, gx, gy)
        st._did_turn_nudge = False
        st._wait_ticks = 0
        st.path = self._plan_path(agent_id, (sx, sy), (gx, gy), st._target_face_dir)

        if st.path:
            st.status = "walking"
        elif (sx, sy) == (gx, gy):
            st.status = next_status
            self._apply_arrival_orientation(st)
        else:
            # Path temporarily blocked by moving agents; keep status walking until tick_loop resolves
            st.status = "walking"

    def _apply_arrival_orientation(self, st: AgentState) -> None:
        if not st._target_face_dir:
            return
        fx, fy = st._target_face_dir
        if abs(fx) < 1e-6 and abs(fy) < 1e-6:
            return
        desired_yaw = _direction_yaw(fx, fy)
        if _angle_diff(st.facing, desired_yaw) > 0.25 and not st._did_turn_nudge:
            ux, uy = _normalize_vec(fx, fy)
            st._did_turn_nudge = True
            st.x = st.target_x - 0.07 * ux
            st.y = st.target_y - 0.07 * uy
            st.path = [(st.target_x, st.target_y)]
            st.status = "walking"
        st.facing = desired_yaw

    def move_agent(
        self,
        agent_id: str,
        gx: int,
        gy: int,
        next_status: str = "idle",
        face_dir: tuple[float, float] | None = None,
        force: bool = False,
    ) -> bool:
        if not self._is_tile_available_for(agent_id, (gx, gy)):
            if force:
                self._evict_if_reserved((gx, gy), agent_id)
            else:
                return False
        self._assign_move(agent_id, gx, gy, next_status, face_dir)
        return True

    def _move_group(
        self,
        assignments: list[tuple[str, int, int, str, tuple[float, float] | None]],
    ) -> None:
        """Atomically reserve targets for a group move before planning paths."""
        for aid, gx, gy, next_status, face_dir in assignments:
            st = self.agents[aid]
            st.idle_steps.clear()
            st.idle_wait_until = 0.0
            st._pending_wait_sec = 0.0
            st._pending_bubble = ""
            st.target_x = gx
            st.target_y = gy
            st._post_walk_status = next_status
            st._target_face_dir = face_dir if face_dir is not None else self._default_face_for(aid, gx, gy)
            st._did_turn_nudge = False
            st._wait_ticks = 0

        for aid, gx, gy, next_status, _ in assignments:
            st = self.agents[aid]
            sx, sy = round(st.x), round(st.y)
            st.path = self._plan_path(aid, (sx, sy), (gx, gy), st._target_face_dir)
            if st.path:
                st.status = "walking"
            elif (sx, sy) == (gx, gy):
                st.status = next_status
                self._apply_arrival_orientation(st)
            else:
                st.status = "walking"

    async def broadcast(self, payload: dict) -> None:
        dead = []
        for ws in list(self.clients):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.clients.discard(ws)

    async def push_message(
        self,
        sender_id: str,
        sender_name: str,
        role: str,
        color: str,
        text: str,
        model_used: str = "",
        msg_type: str = "chat",
    ) -> None:
        msg = {
            "id": f"{int(time.time() * 1000)}-{random.randint(100,999)}",
            "ts": time.strftime("%H:%M:%S"),
            "sender_id": sender_id,
            "sender_name": sender_name,
            "role": role,
            "color": color,
            "text": text,
            "model": model_used,
            "type": msg_type,
        }
        self.messages.append(msg)
        if len(self.messages) > 80:
            self.messages = self.messages[-80:]
        await self.broadcast({"type": "message", "message": msg})

    def get_snapshot(self) -> dict:
        return {
            "type": "state",
            "agents": [a.to_dict() for a in self.agents.values()],
            "economy_mode": settings.economy_mode,
            "task_running": self.task_running,
            "current_task": self.current_task,
            "providers": settings.provider_status(),
            "messages": self.messages[-40:],
        }

    def _step_blocked_reason(self, aid: str, st: AgentState, nx: int, ny: int) -> tuple[bool, bool, bool]:
        """Return (is_blocked, blocked_by_stationary, is_head_on) for next cell (nx, ny)."""
        cur_tile = (round(st.x), round(st.y))
        my_dist = math.hypot(st.x - nx, st.y - ny)
        for oid, other in self.agents.items():
            if oid == aid:
                continue
            other_tile = (round(other.x), round(other.y))
            if not other.path and other_tile == (nx, ny):
                return True, True, False
            if math.hypot(other.x - nx, other.y - ny) < 0.72:
                if not other.path:
                    return True, True, False
                if other.path and other.path[0] == cur_tile:
                    return True, False, True
                other_dist = math.hypot(other.x - nx, other.y - ny)
                if other_dist < my_dist - 0.05 or (abs(other_dist - my_dist) <= 0.05 and aid > oid):
                    return True, False, False
        return False, False, False

    def _advance_agent_movement(self, aid: str, st: AgentState, now: float, speed: float) -> bool:
        if not st.path:
            # Handle case where path was empty only because route was momentarily congested
            if st.status == "walking" and (round(st.x), round(st.y)) != (st.target_x, st.target_y):
                st.path = self._plan_path(
                    aid,
                    (round(st.x), round(st.y)),
                    (st.target_x, st.target_y),
                    st._target_face_dir,
                    extra_blocked=self._occupied_tiles(exclude_id=aid),
                )
                if not st.path:
                    st._wait_ticks += 1
                    if st._wait_ticks > 16 and not self.task_running:
                        fx, fy = DESK_FACING[aid]
                        dx, dy = st.profile.desk_pos
                        st.idle_steps.clear()
                        self._assign_move(aid, dx, dy, "idle", (fx, fy))
                    return False
            return False

        nx, ny = st.path[0]
        is_turn_nudge = (
            len(st.path) == 1
            and st._did_turn_nudge
            and (round(st.x), round(st.y)) == (nx, ny)
        )

        if not is_turn_nudge:
            blocked, by_stationary, head_on = self._step_blocked_reason(aid, st, nx, ny)
            if blocked:
                if by_stationary or head_on or st._wait_ticks >= 3:
                    extra = self._occupied_tiles(exclude_id=aid)
                    if st._wait_ticks >= 3:
                        for oid, other in self.agents.items():
                            if oid != aid and other.path:
                                extra.add(other.path[0])
                    new_path = self._plan_path(
                        aid,
                        (round(st.x), round(st.y)),
                        (st.target_x, st.target_y),
                        st._target_face_dir,
                        extra_blocked=extra,
                    )
                    if new_path and (new_path[0] != (nx, ny) or not by_stationary):
                        st.path = new_path
                        st._wait_ticks = 0
                        nx, ny = st.path[0]
                    else:
                        st._wait_ticks += 1
                        if st._wait_ticks > 18 and st.status != "working" and not self.task_running:
                            st.idle_steps.clear()
                            fx, fy = DESK_FACING[aid]
                            dx, dy = st.profile.desk_pos
                            if (st.target_x, st.target_y) != (dx, dy):
                                self._assign_move(aid, dx, dy, "idle", (fx, fy))
                        return False
                else:
                    st._wait_ticks += 1
                    return False

        st._wait_ticks = 0
        dx = nx - st.x
        dy = ny - st.y
        dist = math.hypot(dx, dy)
        if dist > 1e-4:
            st.facing = _direction_yaw(dx, dy)

        if dist <= speed:
            st.x = float(nx)
            st.y = float(ny)
            st.path.pop(0)
            if not st.path:
                st.status = st._post_walk_status
                self._apply_arrival_orientation(st)
                if not st.path:
                    if st._pending_wait_sec > 0:
                        st.idle_wait_until = now + st._pending_wait_sec
                        st._pending_wait_sec = 0.0
                    if st._pending_bubble:
                        self.set_bubble(aid, st._pending_bubble, 6.0)
                        st._pending_bubble = ""
        else:
            st.x += (dx / dist) * speed
            st.y += (dy / dist) * speed
        return True

    def _start_idle_step(self, aid: str, step: IdleStep) -> None:
        st = self.agents[aid]
        gx, gy = step.gx, step.gy
        face_dir = step.face_dir

        if not self._is_tile_available_for(aid, (gx, gy)):
            reserved = self._reserved_targets(exclude_id=aid)
            if step.category == "coffee":
                alts = [p for p in COFFEE_SPOTS if p not in reserved]
                if alts:
                    gx, gy = random.choice(alts)
                else:
                    gx, gy = st.profile.desk_pos
                    face_dir = DESK_FACING[aid]
                    st.idle_steps.clear()
            elif step.category == "server":
                alts = [p for p in SERVER_SPOTS if p not in reserved]
                if alts:
                    gx, gy = random.choice(alts)
                else:
                    gx, gy = st.profile.desk_pos
                    face_dir = DESK_FACING[aid]
                    st.idle_steps.clear()
            elif step.category == "lounge":
                alts = [p for p in LOUNGE_SPOTS if p not in reserved]
                if alts:
                    gx, gy = random.choice(alts)
                    face_dir = (float(CONFERENCE_CENTER[0] - gx), float(CONFERENCE_CENTER[1] - gy))
                else:
                    gx, gy = st.profile.desk_pos
                    face_dir = DESK_FACING[aid]
                    st.idle_steps.clear()
            else:
                gx, gy = self._nearest_free_tile(aid, (gx, gy))

        st._pending_wait_sec = step.wait_sec
        st._pending_bubble = step.bubble
        self.move_agent(aid, gx, gy, "idle", face_dir=face_dir)

    def _launch_idle_routine(self, aid: str, now: float) -> None:
        st = self.agents[aid]
        reserved = self._reserved_targets(exclude_id=aid)
        desk = st.profile.desk_pos
        desk_face = DESK_FACING[aid]

        # If currently away from own desk with nothing queued, head back cleanly
        if (round(st.x), round(st.y)) != desk:
            self._start_idle_step(
                aid,
                IdleStep(desk[0], desk[1], desk_face, wait_sec=4.0, category="desk"),
            )
            return

        # Keep at least 2 agents at desks so the office looks balanced
        away_count = sum(
            1
            for oid, o in self.agents.items()
            if oid != aid and ((round(o.x), round(o.y)) != o.profile.desk_pos or o.path or o.idle_steps)
        )
        if away_count >= 3:
            return

        routines: list[str] = ["coffee", "visit", "lounge"]
        if aid in ("cybersec", "dev", "lead") or random.random() < 0.3:
            routines.append("server")
        random.shuffle(routines)

        steps: list[IdleStep] = []
        for choice in routines:
            if choice == "coffee":
                free_coffee = [p for p in COFFEE_SPOTS if p not in reserved]
                if not free_coffee:
                    continue
                cx, cy = random.choice(free_coffee)
                bubble = random.choice(COFFEE_PHRASES) if random.random() < 0.55 else ""
                steps.append(IdleStep(cx, cy, (0.0, -1.0), wait_sec=random.uniform(3.5, 5.5), bubble=bubble, category="coffee"))
                if random.random() < 0.5:
                    free_lounge = [p for p in LOUNGE_SPOTS if p not in reserved and p != (cx, cy)]
                    if free_lounge:
                        lx, ly = random.choice(free_lounge)
                        lface = (float(CONFERENCE_CENTER[0] - lx), float(CONFERENCE_CENTER[1] - ly))
                        steps.append(IdleStep(lx, ly, lface, wait_sec=random.uniform(3.5, 5.0), category="lounge"))
                steps.append(IdleStep(desk[0], desk[1], desk_face, wait_sec=5.0, category="desk"))
                break

            if choice == "visit":
                candidates = [
                    tid for tid, pos in COLLAB_VISIT_POS.items()
                    if tid != aid and pos not in reserved
                ]
                if not candidates:
                    continue
                # Prefer colleagues who are actually sitting at their desk
                at_desk = [
                    tid for tid in candidates
                    if (round(self.agents[tid].x), round(self.agents[tid].y)) == self.agents[tid].profile.desk_pos
                    and not self.agents[tid].path
                ]
                tid = random.choice(at_desk or candidates)
                vx, vy = COLLAB_VISIT_POS[tid]
                tdx, tdy = self.agents[tid].profile.desk_pos
                vface = (float(tdx - vx), float(tdy - vy))
                tname = self.agents[tid].profile.name
                vbubble = (
                    random.choice([
                        f"Заглянул к {tname} обсудить пару деталей.",
                        f"{tname}, как идёт прогресс?",
                        f"Сверяю заметки с {tname}.",
                    ])
                    if random.random() < 0.6
                    else ""
                )
                steps.append(IdleStep(vx, vy, vface, wait_sec=random.uniform(4.5, 6.5), bubble=vbubble, category="visit"))
                steps.append(IdleStep(desk[0], desk[1], desk_face, wait_sec=5.0, category="desk"))
                break

            if choice == "server":
                free_srv = [p for p in SERVER_SPOTS if p not in reserved]
                if not free_srv:
                    continue
                sx, sy = random.choice(free_srv)
                sbubble = random.choice(SERVER_PHRASES) if random.random() < 0.6 else ""
                steps.append(IdleStep(sx, sy, (0.0, 1.0), wait_sec=random.uniform(3.5, 5.5), bubble=sbubble, category="server"))
                steps.append(IdleStep(desk[0], desk[1], desk_face, wait_sec=5.0, category="desk"))
                break

            if choice == "lounge":
                free_lounge = [p for p in LOUNGE_SPOTS if p not in reserved]
                if not free_lounge:
                    continue
                # If another agent is already resting in lounge/coffee, stand near and face them
                others_in_lounge = [
                    o for oid, o in self.agents.items()
                    if oid != aid and not o.path and (round(o.x), round(o.y)) in (LOUNGE_SPOTS + COFFEE_SPOTS)
                ]
                if others_in_lounge:
                    partner = random.choice(others_in_lounge)
                    px, py = round(partner.x), round(partner.y)
                    lx, ly = min(free_lounge, key=lambda p: abs(p[0] - px) + abs(p[1] - py))
                    lface = (float(px - lx), float(py - ly))
                else:
                    lx, ly = random.choice(free_lounge)
                    lface = (float(CONFERENCE_CENTER[0] - lx), float(CONFERENCE_CENTER[1] - ly))
                lbubble = random.choice(LOUNGE_PHRASES) if random.random() < 0.45 else ""
                steps.append(IdleStep(lx, ly, lface, wait_sec=random.uniform(4.0, 6.0), bubble=lbubble, category="lounge"))
                steps.append(IdleStep(desk[0], desk[1], desk_face, wait_sec=5.0, category="desk"))
                break

        if steps:
            first = steps.pop(0)
            st.idle_steps = steps
            self._start_idle_step(aid, first)

    async def tick_loop(self) -> None:
        while True:
            now = time.time()
            moved = False
            speed = 0.22

            for aid, st in self.agents.items():
                if self._advance_agent_movement(aid, st, now, speed):
                    moved = True

                # Advance queued multi-step idle routine once wait timer expires
                if (
                    not self.task_running
                    and not st.path
                    and st.status == "idle"
                    and st.idle_steps
                    and now >= st.idle_wait_until
                ):
                    nxt = st.idle_steps.pop(0)
                    self._start_idle_step(aid, nxt)

            # Free multi-step idle wandering (strictly 0 LLM tokens)
            if not self.task_running and now - self._last_wander > self._next_wander_delay:
                self._last_wander = now
                self._next_wander_delay = random.uniform(5.5, 9.5)
                eligible = [
                    aid for aid, st in self.agents.items()
                    if not st.path and not st.idle_steps and st.status == "idle" and now >= st.idle_wait_until
                ]
                if eligible:
                    self._launch_idle_routine(random.choice(eligible), now)

            # Economy-mode ambient conversation (zero tokens when economy_mode is active)
            interval = settings.idle_chat_interval_sec if settings.economy_mode else 28
            if not self.task_running and now - self._last_idle_chat > interval:
                self._last_idle_chat = now
                asyncio.create_task(self._run_ambient_banter())

            if moved or int(now * 2) % 4 == 0:
                await self.broadcast({
                    "type": "positions",
                    "agents": [a.to_dict() for a in self.agents.values()],
                    "task_running": self.task_running,
                })
            await asyncio.sleep(0.12)

    async def _run_ambient_banter(self) -> None:
        a1, a2 = random.sample(list(self.agents.values()), 2)
        if settings.economy_mode:
            phrase = random.choice(a1.profile.idle_phrases)
            self.set_bubble(a1.profile.id, phrase, 7.0)
            await self.push_message(
                a1.profile.id, a1.profile.name, a1.profile.role, a1.profile.color,
                phrase, "economy/0-tokens", "ambient"
            )
            return

        prompt = (
            f"Ты в офисе в перерыве общаешься с коллегой {a2.profile.name} ({a2.profile.role}). "
            f"Скажи одну короткую живую реплику (до 18 слов) по своей теме ({a1.profile.specialty})."
        )
        reply, used = await generate_agent_reply(a1.profile, prompt, max_tokens=70, is_idle=True)
        self.set_bubble(a1.profile.id, reply, 8.0)
        await self.push_message(
            a1.profile.id, a1.profile.name, a1.profile.role, a1.profile.color,
            reply, used, "ambient"
        )

    def start_task(self, task_text: str, target_agent: str = "all") -> None:
        self._active_task_handle = asyncio.create_task(self.run_task(task_text, target_agent))

    async def stop_task(self) -> bool:
        if not self.task_running and self._active_task_handle is None:
            return False
        if self._active_task_handle and not self._active_task_handle.done():
            self._active_task_handle.cancel()
            try:
                await self._active_task_handle
            except asyncio.CancelledError:
                pass
        self._active_task_handle = None
        self.task_running = False
        self.current_task = ""
        assignments = []
        for aid, st in self.agents.items():
            st.collaborating_with = ""
            dx, dy = st.profile.desk_pos
            assignments.append((aid, dx, dy, "idle", DESK_FACING[aid]))
            self.set_bubble(aid, "Задача остановлена, возвращаюсь на место.", 4.5)
        self._move_group(assignments)
        await self.push_message(
            "lead", "Атлас (Система)", "Тимлид / Стратег", "#f43f5e",
            "Выполнение текущей задачи остановлено по команде босса. Команда вернулась в режим ожидания.",
            "system/control", "chat"
        )
        await self.broadcast(self.get_snapshot())
        return True

    async def run_task(self, task_text: str, target_agent: str = "all") -> None:
        if self.task_running:
            return
        self.task_running = True
        self.current_task = task_text
        for st in self.agents.values():
            st.idle_steps.clear()
            st.idle_wait_until = 0.0
            st._pending_wait_sec = 0.0
            st._pending_bubble = ""
        try:
            await self.push_message("user", "Вы (Босс)", "Постановщик задачи", "#ffffff", task_text, "", "user")

            if target_agent != "all" and target_agent in self.agents:
                st = self.agents[target_agent]
                dx, dy = st.profile.desk_pos
                self.move_agent(target_agent, dx, dy, "working", face_dir=DESK_FACING[target_agent], force=True)
                self.set_bubble(target_agent, "Принял задачу, работаю…", 6.0)
                await asyncio.sleep(1.5)
                reply, used = await generate_agent_reply(st.profile, task_text)
                self.set_bubble(target_agent, reply, 10.0)
                await self.push_message(
                    st.profile.id, st.profile.name, st.profile.role, st.profile.color,
                    reply, used, "result"
                )
                return

            # 1. Gather all agents at the conference table (atomic reservation avoids seat collisions)
            self._move_group([
                (
                    aid,
                    st.profile.meeting_pos[0],
                    st.profile.meeting_pos[1],
                    "meeting",
                    (
                        float(CONFERENCE_CENTER[0] - st.profile.meeting_pos[0]),
                        float(CONFERENCE_CENTER[1] - st.profile.meeting_pos[1]),
                    ),
                )
                for aid, st in self.agents.items()
            ])

            lead = self.agents["lead"].profile
            self.set_bubble("lead", "Команда, все в переговорную!", 6.0)
            await asyncio.sleep(2.2)

            # 2. Lead breaks down the task and picks relevant specialists
            plan_prompt = (
                f"Босс поставил задачу: «{task_text}».\n"
                f"Кратко (3-4 пункта) распредели, что должны сделать: Вектор (кибербез/пентест), "
                f"Нова (код/автоматизация), Пульс (продвижение/контент), Шейдер (Motion Graphics). "
                f"Отмечай только тех, кто реально нужен для этой задачи."
            )
            plan_text, lead_model = await generate_agent_reply(lead, plan_prompt, max_tokens=320)
            self.set_bubble("lead", plan_text, 9.0)
            await self.push_message(lead.id, lead.name, lead.role, lead.color, plan_text, lead_model, "chat")

            # 3. Specialists go to their desks and execute in parallel
            specialists = ["cybersec", "dev", "growth", "motion"]
            self._move_group([
                (
                    sid,
                    self.agents[sid].profile.desk_pos[0],
                    self.agents[sid].profile.desk_pos[1],
                    "working",
                    DESK_FACING[sid],
                )
                for sid in specialists
            ])
            for sid in specialists:
                self.set_bubble(sid, "Иду за стол делать свою часть…", 5.0)
            await asyncio.sleep(1.5)

            async def run_spec(sid: str) -> tuple[str, str, str]:
                prof = self.agents[sid].profile
                sp_prompt = (
                    f"Задача от босса: «{task_text}».\n"
                    f"План тимлида:\n{plan_text}\n\n"
                    f"Дай конкретный, практический вклад именно по твоей специализации ({prof.specialty}). "
                    f"Если твоя область тут не нужна, ответь одной короткой строкой, что готов поддержать."
                )
                ans, mod = await generate_agent_reply(prof, sp_prompt)
                self.set_bubble(sid, ans, 9.0)
                await self.push_message(prof.id, prof.name, prof.role, prof.color, ans, mod, "chat")
                return sid, prof.name, ans

            spec_outputs = await asyncio.gather(*(run_spec(s) for s in specialists))
            ans_by_id = {sid: ans for sid, _, ans in spec_outputs}
            results = [(name, ans) for _, name, ans in spec_outputs]

            # 4. Agent-to-agent peer review & physical desk visits
            vx, vy = COLLAB_VISIT_POS["dev"]
            dev_dx, dev_dy = self.agents["dev"].profile.desk_pos
            self.agents["cybersec"].collaborating_with = "dev"
            self.agents["dev"].collaborating_with = "cybersec"
            self.move_agent(
                "cybersec", vx, vy, "meeting",
                face_dir=(float(dev_dx - vx), float(dev_dy - vy)),
                force=True,
            )
            self.set_bubble("cybersec", "Иду к Нове проверить безопасность кода…", 5.0)

            gx, gy = COLLAB_VISIT_POS["motion"]
            mot_dx, mot_dy = self.agents["motion"].profile.desk_pos
            self.agents["growth"].collaborating_with = "motion"
            self.agents["motion"].collaborating_with = "growth"
            self.move_agent(
                "growth", gx, gy, "meeting",
                face_dir=(float(mot_dx - gx), float(mot_dy - gy)),
                force=True,
            )
            self.set_bubble("growth", "Иду к Шейдеру синхронизировать визуал и хуки…", 5.0)

            await asyncio.sleep(2.0)

            async def run_peer_review(
                reviewer_id: str,
                target_id: str,
                focus_hint: str,
            ) -> tuple[str, str]:
                rev_prof = self.agents[reviewer_id].profile
                tgt_prof = self.agents[target_id].profile
                tgt_draft = ans_by_id.get(target_id, "")
                peer_prompt = (
                    f"Ты подошёл к рабочему столу коллеги {tgt_prof.name} ({tgt_prof.role}) по задаче «{task_text}».\n"
                    f"Наработка коллеги:\n{tgt_draft[:600]}\n\n"
                    f"Дай короткое, острое экспертное ревью (2-3 предложения) со стороны своей роли ({focus_hint}): "
                    f"что усилить или исправить прямо сейчас."
                )
                rev_text, rev_mod = await generate_agent_reply(rev_prof, peer_prompt, max_tokens=220)
                self.set_bubble(reviewer_id, f"@{tgt_prof.name}: {rev_text}", 8.0)
                await self.push_message(
                    rev_prof.id,
                    f"{rev_prof.name} → {tgt_prof.name}",
                    f"Ревью ({rev_prof.role})",
                    rev_prof.color,
                    rev_text,
                    rev_mod,
                    "chat",
                )
                return f"Ревью {rev_prof.name} для {tgt_prof.name}", rev_text

            peer_reviews = await asyncio.gather(
                run_peer_review("cybersec", "dev", "хардening, защита API и уязвимости"),
                run_peer_review("growth", "motion", "удержание внимания, динамика первых 3 секунд и CTR"),
            )
            results.extend(peer_reviews)

            # Return visiting agents to their own desks
            for sid in specialists:
                self.agents[sid].collaborating_with = ""
            self._move_group([
                (
                    sid,
                    self.agents[sid].profile.desk_pos[0],
                    self.agents[sid].profile.desk_pos[1],
                    "idle",
                    DESK_FACING[sid],
                )
                for sid in specialists
            ])

            # 5. Lead synthesizes final cohesive result
            dx, dy = lead.desk_pos
            self.move_agent("lead", dx, dy, "working", face_dir=DESK_FACING["lead"], force=True)
            joined = "\n\n".join(f"### {name}:\n{ans}" for name, ans in results)
            final_prompt = (
                f"Задача босса: «{task_text}».\n"
                f"Наработки команды и взаимное ревью:\n{joined}\n\n"
                f"Собери из этого чёткий, готовый к применению финальный ответ для босса (структурно, без воды)."
            )
            final_text, final_mod = await generate_agent_reply(lead, final_prompt, max_tokens=900)
            self.set_bubble("lead", "Готово! Итоговый отчёт в чате.", 10.0)
            await self.push_message(
                lead.id, f"{lead.name} (Итог)", lead.role, lead.color, final_text, final_mod, "result"
            )
        except asyncio.CancelledError:
            raise
        finally:
            self.task_running = False
            self.current_task = ""
            self._active_task_handle = None
            for st in self.agents.values():
                st.collaborating_with = ""
                if st._post_walk_status in ("working", "meeting"):
                    st._post_walk_status = "idle"
                if st.status in ("working", "meeting"):
                    st.status = "idle"


sim = OfficeSimulation()
