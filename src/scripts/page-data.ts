// The desktop's model and addresses, written into the page as JSON by
// src/layouts/Desktop.astro: parsed once, here, for every script that reads
// them. Each is undefined on a page without the desktop.
import {
  type AddressBook,
  type AddressData,
  openAddresses,
} from "../lib/addresses";
import type { Workspace } from "../lib/workspaces";

const json = <T>(id: string): T | undefined => {
  const text = document.getElementById(id)?.textContent;
  return text ? (JSON.parse(text) as T) : undefined;
};

/** The workspaces and their steps, from #desktop-model. */
export const model = json<Workspace[]>("desktop-model");

const data = json<AddressData>("desktop-addresses");
/** Every address of the desktop, from #desktop-addresses. */
export const addresses: AddressBook | undefined = data && openAddresses(data);
