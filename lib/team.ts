export function commercialWhatsApp(phone: string) {
  const compact = phone.replace(/[\s()-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(compact)
    ? `https://wa.me/${compact.slice(1)}`
    : null;
}
