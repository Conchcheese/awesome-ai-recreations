// The two sequences the gear lives through, as functions of tau (seconds into the sequence): the takeoff (roll, lift
// off, the gear comes up) and the landing (the gear comes down, the flare, touchdown, rollout). Each gives the
// stroke (0 down, 1 up), the height above the runway, the ground speed and the phase line the console shows.
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
export const H_MAX = 1.7;
export const V_MAX = 14;

export const SEQ = {
  takeoff: {
    dur: 5,
    from: '跑道',
    to: '收上',
    stroke: (t) => ss(2.3, 4.5, t),
    height: (t) => H_MAX * Math.pow(ss(1.9, 5.0, t), 1.25),
    speed: (t) => V_MAX * ss(0, 2.0, t),
    phases: [
      [0, '在跑道上'],
      [0.6, '起飞滑跑'],
      [1.9, '离地'],
      [2.3, '作动筒向后伸出'],
      [3.0, '齿条带动齿轮'],
      [3.6, '侧管把腿旋上去'],
      [4.5, '起落架收上并锁定'],
    ],
  },
  landing: {
    dur: 7,
    from: '收上',
    to: '跑道',
    stroke: (t) => 1 - ss(0.6, 3.0, t),
    height: (t) => H_MAX * (1 - ss(0, 5.2, t)),
    speed: (t) => V_MAX * (1 - ss(5.2, 7.0, t)),
    phases: [
      [0, '选择放下起落架'],
      [0.6, '作动筒向前收回'],
      [1.3, '侧管把腿旋下来'],
      [3.0, '起落架放下并锁定'],
      [5.0, '接地'],
      [5.5, '滑跑'],
    ],
  },
};
export const phaseAt = (seq, t) => SEQ[seq].phases.filter(([a]) => a <= t).pop()[1];
/** the mechanism state chip: [title, sub, colour key] */
export const stateAt = (stroke, height) => {
  if (stroke < 0.002) return height < 0.01 ? ['起落架放下锁定', '在跑道上', 'ok'] : ['起落架放下锁定', `空中 · ${height.toFixed(2)} M`, 'ok'];
  if (stroke > 0.998) return ['起落架收上锁定', `空中 · ${height.toFixed(2)} M`, 'ok'];
  return ['收放中', height < 0.01 ? '在跑道上' : `空中 · ${height.toFixed(2)} M`, 'move'];
};
