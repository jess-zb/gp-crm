export function mapPostlogicStatusToLabel(status: string | null): string {
  if (!status) return "—";
  const map: Record<string, string> = {
    processing: "Received",
    Processing: "Received",
    production: "Printing",
    Production: "Printing",
    "label created": "Labeled",
    "Label Created": "Labeled",
    "in transit": "Shipped",
    "In Transit": "Shipped",
    "out for delivery": "Out",
    "Out for Delivery": "Out",
    delivered: "Delivered",
    Delivered: "Delivered",
  };
  return map[status] || status;
}

export function getStatusBadgeClass(status: string | null): string {
  const s = (status || "").toLowerCase();
  if (s === "delivered") return "bg-green-100 text-green-700";
  if (s === "in transit" || s === "out for delivery") return "bg-blue-100 text-blue-700";
  if (s === "label created") return "bg-purple-100 text-purple-700";
  if (s === "production") return "bg-yellow-100 text-yellow-700";
  if (s === "processing") return "bg-gray-100 text-gray-600";
  return "bg-gray-100 text-gray-500";
}
