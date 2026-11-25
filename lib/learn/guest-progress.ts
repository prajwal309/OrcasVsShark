export const guestProgressKey = "orcas-academy-guest-v1";

export function guestProgressImportKey(username: string) {
  return `orcas-academy-guest-upgrade-v1:${username}`;
}
