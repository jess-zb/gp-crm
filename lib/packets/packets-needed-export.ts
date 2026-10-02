import type { PacketNeededRow } from "@/app/admin/fedex-batches/packet-manager-types";

export type PacketsNeededExportRow = {
  name: string;
  advisor: string;
  merchant: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
};

function csvCell(value: string): string {
  const v = value ?? "";
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function packetNeededRowToExportRow(
  row: PacketNeededRow,
  opts: {
    fullName: (r: PacketNeededRow) => string;
    advisor: (r: PacketNeededRow) => string;
    merchant: (r: PacketNeededRow) => string;
  }
): PacketsNeededExportRow {
  return {
    name: opts.fullName(row),
    advisor: opts.advisor(row),
    merchant: opts.merchant(row),
    address: row.street_address?.trim() ?? "",
    city: row.city?.trim() ?? "",
    state: row.state?.trim() ?? "",
    zip: row.zip_code?.trim() ?? "",
    phone: row.phone_mobile?.trim() ?? "",
  };
}

/** PostLogic column order: Name, Advisor, Merchant, Address, City, State, Zip, Phone */
export function buildPacketsNeededCsv(rows: PacketsNeededExportRow[]): string {
  const header = "Name,Advisor,Merchant,Address,City,State,Zip,Phone";
  const body = rows
    .map((r) =>
      [
        csvCell(r.name),
        csvCell(r.advisor),
        csvCell(r.merchant),
        csvCell(r.address),
        csvCell(r.city),
        csvCell(r.state),
        csvCell(r.zip),
        csvCell(r.phone),
      ].join(",")
    )
    .join("\n");
  return `${header}\n${body}`;
}

export function downloadPacketsNeededCsv(csv: string, filenamePrefix = "packets-needed"): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
