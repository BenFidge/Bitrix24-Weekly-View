export function toDateValue(d: Date): string {
  // Formats a Date as YYYY-MM-DD in local time (Bitrix booking API date format)
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
