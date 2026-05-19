export const fmtMoney = (n: number | string) =>
  Number(n).toLocaleString("vi-VN") + "₫";

export const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

export const fmtPeriod = (p: string) => {
  const [y, m] = p.split("-");
  return `T${Number(m)}/${y}`;
};

export const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
