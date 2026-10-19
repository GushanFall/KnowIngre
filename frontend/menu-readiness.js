const key = value => String(value || '').replace(/[（(][^）)]*[）)]/g, '').replace(/\s+/g, '').toLowerCase();
const quantity = value => String(Number(Number(value).toFixed(6)));
const measure = (value, unit) => `${quantity(value)}${unit ? ` ${unit}` : ''}`;

// Use the server's cooking plan, so shopping badges and actual deductions agree.
export function ingredientReadiness(name, plan, failed = false) {
  if (!plan) return { status: failed ? 'review' : 'checking', label: failed ? '待核对' : '核对中', detail: failed ? '暂时无法核对，请刷新后重试' : '正在核对合计用量' };
  const rows = plan.items.filter(item => key(item.name) === key(name) || item.requirements?.some(entry => key(entry.name) === key(name)));
  if (!rows.length) return { status: 'review', label: '待核对', detail: '请确认食材名称与库存记录' };
  if (rows.some(item => !item.inventoryId)) return { status: 'missing', label: '待采购', detail: '库存中还没有这项食材' };
  if (rows.every(item => item.skipDeduction)) return { status: 'pantry', label: '常备', detail: '已有调料，本次不扣减' };
  const unresolved = rows.find(item => !item.skipDeduction && item.status !== 'ready');
  if (unresolved) return { status: 'review', label: '待确认', detail: unresolved.status === 'needs-conversion' ? '计量单位不同，需要确认换算' : '用量无法直接计算，需要确认余量', inventoryId: unresolved.inventoryId };
  const shortage = rows.find(item => item.insufficient);
  if (shortage) return { status: 'short', label: '数量不足', detail: `还差 ${measure(shortage.convertedNeeded - shortage.stockQuantity, shortage.inventoryUnit)}`, inventoryId: shortage.inventoryId };
  const used = rows.filter(item => !item.skipDeduction).map(item => measure(item.convertedNeeded, item.inventoryUnit));
  return { status: 'ready', label: '已备齐', detail: `本次需 ${used.join(' + ')}`, inventoryId: rows[0].inventoryId };
}
