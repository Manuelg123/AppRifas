export function getRangeList(rangeKey) {
  const map = {
    '0-99': { start: 0, end: 99, pad: 2 },
    '1-100': { start: 1, end: 100, pad: 2 },
    '0-999': { start: 0, end: 999, pad: 3 },
    '1-1000': { start: 1, end: 1000, pad: 3 }
  };

  const cfg = map[rangeKey] || map['1-100'];
  const list = [];

  for (let i = cfg.start; i <= cfg.end; i++) {
    list.push({
      raw: i,
      label: String(i).padStart(cfg.pad, '0')
    });
  }

  return { ...cfg, list };
}

export function getPairedLabel(item, rangeCfg) {
  const totalSum = rangeCfg.start + rangeCfg.end;
  const partnerRaw = totalSum - item.raw;
  if (partnerRaw === item.raw) return null;
  return String(partnerRaw).padStart(rangeCfg.pad, '0');
}