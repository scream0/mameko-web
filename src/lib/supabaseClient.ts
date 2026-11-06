/**
 * src/lib/supabaseClient.ts
 *
 * PROXY ALIAS (Mameko Native Migration)
 * Seluruh logika telah dipindahkan secara mandiri ke src/lib/mamekoClient.ts.
 * File ini bertindak sebagai re-export untuk kompatibilitas import yang sudah ada.
 */

export * from "./mamekoClient";
import { mamekoClient } from "./mamekoClient";
export default mamekoClient;
