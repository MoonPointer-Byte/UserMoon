type Opts = {
  direction: "diagonal";
  speed: number;
  borderColor: string;
  squareSize: number;
  hoverFillColor: string;
  hoverShadowColor: string;
  transitionDuration: number;
  trailDuration: number;
  specialBlockColor: string;
  snakeHeadColor: string;
  snakeTailColor: string;
  snakeColorDecay: number;
};

type Cell = { x: number; y: number };

export function startGrid(canvas: HTMLCanvasElement, options: Opts) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => undefined;
  const gridOffset = { x: 0, y: 0 };
  let hovered: Cell | null = null;
  let currentOpacity = 0;
  let targetOpacity = 0;
  let last = 0;
  const snake: Cell[] = [];
  let shouldGrow = false;
  let special: Cell | null = null;
  let frame = 0;
  const trails = new Map<string, { x: number; y: number; opacity: number }>();

  const resize = () => {
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const placeSpecial = () => {
    const ratio = window.devicePixelRatio || 1;
    const cols = Math.max(3, Math.ceil(canvas.width / ratio / options.squareSize));
    const rows = Math.max(3, Math.ceil(canvas.height / ratio / options.squareSize));
    let cell: Cell = { x: 1, y: 1 };
    for (let n = 0; n < 20; n += 1) {
      cell = {
        x: 1 + Math.floor(Math.random() * (cols - 2)),
        y: 1 + Math.floor(Math.random() * (rows - 2)),
      };
      if (!snake.some((part) => part.x === cell.x && part.y === cell.y)) break;
    }
    special = cell;
  };

  const hit = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const originX = Math.floor(gridOffset.x / options.squareSize) * options.squareSize;
    const originY = Math.floor(gridOffset.y / options.squareSize) * options.squareSize;
    const cell = {
      x: Math.floor((x + gridOffset.x - originX) / options.squareSize),
      y: Math.floor((y + gridOffset.y - originY) / options.squareSize),
    };
    if (hovered && hovered.x === cell.x && hovered.y === cell.y) return;
    if (hovered) {
      snake.unshift({ x: hovered.x, y: hovered.y });
      if (!shouldGrow && snake.length) snake.pop();
      shouldGrow = false;
      if (snake.length > 28) snake.pop();
    }
    hovered = cell;
    targetOpacity = 0.6;
    if (special && cell.x === special.x && cell.y === special.y) {
      shouldGrow = true;
      placeSpecial();
    }
  };

  const onMove = (event: MouseEvent) => hit(event.clientX, event.clientY);
  const onLeave = () => {
    hovered = null;
    targetOpacity = 0;
  };
  const onTouch = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (touch) hit(touch.clientX, touch.clientY);
  };

  const draw = (now: number) => {
    const ratio = window.devicePixelRatio || 1;
    const dt = last ? now - last : 16;
    last = now;
    if (currentOpacity !== targetOpacity) {
      const t = Math.min(dt / options.transitionDuration, 1);
      currentOpacity += (targetOpacity - currentOpacity) * t;
    }
    for (const [key, trail] of trails) {
      trail.opacity -= dt / options.trailDuration;
      if (trail.opacity <= 0) trails.delete(key);
    }
    gridOffset.x = (gridOffset.x - options.speed + options.squareSize) % options.squareSize;
    gridOffset.y = (gridOffset.y - options.speed + options.squareSize) % options.squareSize;

    const viewW = canvas.width / ratio;
    const viewH = canvas.height / ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, viewW, viewH);
    const size = options.squareSize;
    const ox = Math.floor(gridOffset.x / size) * size;
    const oy = Math.floor(gridOffset.y / size) * size;

    const paintCell = (cell: Cell, color: string, blur = 0) => {
      const x = Math.round(cell.x * size + ox - (gridOffset.x % size));
      const y = Math.round(cell.y * size + oy - (gridOffset.y % size));
      ctx.shadowColor = blur ? options.hoverShadowColor : "transparent";
      ctx.shadowBlur = blur;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, size, size);
      ctx.shadowBlur = 0;
    };

    snake.forEach((part, index) => {
      const decay = Math.pow(options.snakeColorDecay, index);
      const color = index === 0 ? options.snakeHeadColor : `rgba(218, 231, 255, ${Math.max(0.2, decay)})`;
      paintCell(part, color, 15);
    });

    ctx.lineWidth = 0.5;
    for (let x = ox; x < viewW + size; x += size) {
      for (let y = oy; y < viewH + size; y += size) {
        const px = Math.round(x - (gridOffset.x % size));
        const py = Math.round(y - (gridOffset.y % size));
        const cx = Math.floor((x - ox) / size);
        const cy = Math.floor((y - oy) / size);
        if (special && cx === special.x && cy === special.y) paintCell(special, options.specialBlockColor, 20);
        if (hovered && cx === hovered.x && cy === hovered.y) {
          paintCell(hovered, options.hoverFillColor.replace("0.8", String(currentOpacity)), 15);
        }
        ctx.strokeStyle = options.borderColor;
        ctx.strokeRect(px, py, size, size);
      }
    }

    const vignette = ctx.createRadialGradient(viewW / 2, viewH / 2, 0, viewW / 2, viewH / 2, Math.hypot(viewW, viewH) / 2);
    vignette.addColorStop(0, "rgba(6, 6, 6, 0)");
    vignette.addColorStop(1, "#060606");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, viewW, viewH);
    frame = window.requestAnimationFrame(draw);
  };

  resize();
  placeSpecial();
  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mouseleave", onLeave);
  canvas.addEventListener("touchmove", onTouch, { passive: true });
  window.addEventListener("resize", resize);
  frame = window.requestAnimationFrame(draw);

  return () => {
    window.cancelAnimationFrame(frame);
    canvas.removeEventListener("mousemove", onMove);
    canvas.removeEventListener("mouseleave", onLeave);
    canvas.removeEventListener("touchmove", onTouch);
    window.removeEventListener("resize", resize);
  };
}
