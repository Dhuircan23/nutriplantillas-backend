// Genera códigos con el mismo formato que ya usa el prototipo actual: NP-2026-XXXXX
function generateOrderCode() {
  const year = new Date().getFullYear();
  const n = Math.floor(100000 + Math.random() * 899999);
  return `NP-${year}-${n}`;
}

module.exports = { generateOrderCode };
