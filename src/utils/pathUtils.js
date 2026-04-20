export function getPositionOnPath(path, t) {
  if (t <= 0) return path[0];
  if (t >= 1) return path[path.length - 1];

  const lengths = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const dx = path[i + 1][0] - path[i][0];
    const dy = path[i + 1][1] - path[i][1];
    const len = Math.sqrt(dx * dx + dy * dy);
    lengths.push(len);
    total += len;
  }

  let target = t * total;
  for (let i = 0; i < lengths.length; i++) {
    if (target <= lengths[i]) {
      const u = lengths[i] > 0 ? target / lengths[i] : 0;
      return [
        path[i][0] + (path[i + 1][0] - path[i][0]) * u,
        path[i][1] + (path[i + 1][1] - path[i][1]) * u,
      ];
    }
    target -= lengths[i];
  }
  return path[path.length - 1];
}
