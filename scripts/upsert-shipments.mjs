/**
 * One-off script: upsert May 17, 20, and 25 2026 shipment batches into client_fedex_shipments.
 * Run: node scripts/upsert-shipments.mjs
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ceyzxzyjuynbhwigrsqp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNleXp4enlqdXluYmh3aWdyc3FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5MzgxNSwiZXhwIjoyMDkxNzY5ODE1fQ.g7ffqB6nWjJ9prodLMwSw0HhJjbv21FGuVEpoyFhGlc",
  { auth: { persistSession: false } }
);

// Raw data from tracking sheet (Name, Advisor, Merchant, Address, City, State, Zip, Phone, Status, Tracking, DateAdded)
const RAW = [
  // ── May 25 batch ──────────────────────────────────────────────────────────
  ["Sandra Stetzer",        "Lindsey", "Council Pay",      "W1864 County Road T",        "Mindoro",        "WI", "54644", "(608) 857-3585", "Completed", "872206162028", "2026-05-25"],
  ["George Clark",          "Bobby",   "Council Pay",      "3344 West 1680 North",        "Clinton",        "UT", "84015", "(317) 373-7710", "Completed", "872206161580", "2026-05-25"],
  ["Wayne Wilson",          "Maya",    "Council Pay",      "38 West Charleston Avenue",   "Lawnside",       "NJ", "08045", "(856) 547-4506", "Completed", "872206161764", "2026-05-25"],
  ["Gary Jones",            "Lindsey", "Progressive",      "541 Bryce Court",             "Milpitas",       "CA", "95035", "(408) 314-6302", "Completed", "872206161227", "2026-05-25"],
  ["Kathi Wilson",          "Maya",    "Council Pay",      "1512 Birdell Road",           "Coatesville",    "PA", "19320", "(717) 203-1688", "Completed", "872206161992", "2026-05-25"],
  ["William Post",          "Bobby",   "Council Pay",      "787 Sunview Street",          "Eugene",         "OR", "97404", "(541) 554-4419", "Completed", "872206160816", "2026-05-25"],
  ["Tizza Chace",           "Caleb",   "Horizon",          "2873 Presley Avenue",         "Grand Junction", "CO", "81501", "(816) 977-7441", "Completed", "872206161124", "2026-05-25"],
  ["David Jones",           "Maya",    "Progressive",      "2055 Riviera Drive",          "Blythe",         "CA", "92225", "(760) 898-1041", "Completed", "872206161010", "2026-05-25"],
  ["Kay Hazlett",           "Marissa", "Horizon",          "7302 Valeside Lane",          "Olmsted twp",    "OH", "44138", "(440) 382-4612", "Completed", "872206160312", "2026-05-25"],
  ["Eric Tremont",          "Marissa", "Progressive",      "456 East Garfield Street",    "Tempe",          "AZ", "85288", "(602) 481-3119", "Completed", "872206158920", "2026-05-25"],
  ["Teena Herrera",         "Lindsey", "Council Pay",      "103 South 900 East",          "Spanish Fork",   "UT", "84660", "(801) 369-2707", "Completed", "872206161396", "2026-05-25"],
  ["Tori Blevins",          "Caleb",   "Progressive",      "1551 Claremont Drive",        "Manteca",        "CA", "95336", "(805) 478-0635", "Completed", "872206161867", "2026-05-25"],
  ["Kellie Cognetti",       "Marissa", "Council Pay",      "814 Shaws Flat Road",         "Sonora",         "CA", "95370", "(209) 206-2283", "Completed", "872206161385", "2026-05-25"],
  ["Joseph Cognetti",       "Marissa", "Council Pay",      "814 Shaws Flat Road",         "Sonora",         "CA", "95370", "(209) 206-2283", "Completed", "872206160404", "2026-05-25"],
  ["James Byrd",            "Lindsey", "Council Pay",      "1181 Otter Slide Loop",       "Townsend",       "GA", "31331", "(478) 279-1822", "Completed", "872206161694", "2026-05-25"],
  ["Donna Byrd",            "Lindsey", "Council Pay",      "1181 Otter Slide Loop",       "Townsend",       "GA", "31331", "(478) 279-1822", "Completed", "872206161113", "2026-05-25"],
  ["Otis Penick",           "Caleb",   "Council Pay",      "101 Union Camp Road",         "Dora",           "AL", "35062", "(205) 514-3091", "Completed", "872206161970", "2026-05-25"],
  ["Elda Farr",             "Marissa", "Golden Pathway",   "12646 Delphia Street",        "Caldwell",       "ID", "83607", "(321) 961-6676", "Completed", "872206161260", "2026-05-25"],

  // ── May 20 batch ──────────────────────────────────────────────────────────
  ["Brian Wilbur",          "Lindsey", "Zero Consulting",  "2818 Dry Creek Rd",           "Screven",        "GA", "31560", "(912) 207-0315", "Completed", "872082532787", "2026-05-20"],
  ["Donnita Benson",        "Caleb",   "Council Pay",      "11215 Queen Anne Avenue",     "Oklahoma City",  "OK", "73114", "(405) 430-2948", "Completed", "872082533533", "2026-05-20"],
  ["Jolene Deplonty",       "Caleb",   "Council Pay",      "6225 South Shunk Road",       "Sault Ste. Marie","MI","49783", "(906) 630-9301", "Completed", "872082532022", "2026-05-20"],
  ["Mary Flores",           "Marissa", "Council Pay",      "418 South Arapaho Drive",     "Santa Ana",      "CA", "92704", "(714) 492-0198", "Completed", "872082531920", "2026-05-20"],
  ["Patricia Eakins",       "Caleb",   "Progressive",      "229 AL Suber Drive",          "Perry",          "FL", "32347", "(850) 371-0588", "Completed", "872082532618", "2026-05-20"],
  ["Amelia Sim",            "Lindsey", "Council Pay",      "765 Eldorado Boulevard",      "Broomfield",     "CO", "80021", "(352) 281-8810", "Completed", "872082532125", "2026-05-20"],
  ["Weldon Miller",         "Marissa", "Council Pay",      "401 Magnolia Blossom",        "League City",    "TX", "77573", "(281) 508-6447", "Completed", "872082532261", "2026-05-20"],
  ["Judithann Heigel",      "Bobby",   "Council Pay",      "135 Brewster Road",           "Milford",        "CT", "06460", "(203) 913-4694", "Completed", "872082531997", "2026-05-20"],
  ["Alexandria Fernandez",  "Marissa", "Horizon",          "74-5109 Wiliwili Way",        "Kailua-Kona",    "HI", "96740", "(808) 557-7851", "Completed", "872082530523", "2026-05-20"],
  ["Diane Byrne",           "Lindsey", "Council Pay",      "11 Porter Avenue",            "Carbondale",     "PA", "18407", "(570) 906-7348", "Completed", "872082531596", "2026-05-20"],
  ["Robert Byrne",          "Lindsey", "Council Pay",      "11 Porter Avenue",            "Carbondale",     "PA", "18407", "(570) 906-7348", "Completed", "872082531508", "2026-05-20"],
  ["Melissa Brown",         "Lindsey", "Adsm",             "3951 Inwood Avenue",          "New Orleans",    "LA", "70131", "(504) 339-5152", "Completed", "872082531070", "2026-05-20"],
  ["Mary Mosley",           "Maya",    "Council Pay",      "8126 Alamosa Wood Avenue",    "Ruskin",         "FL", "33573", "(813) 477-4636", "Completed", "872082529850", "2026-05-20"],
  ["Willie Mosley",         "Maya",    "Council Pay",      "8126 Alamosa Wood Avenue",    "Ruskin",         "FL", "33573", "(813) 477-4636", "Completed", "872082533018", "2026-05-20"],
  ["Eddie Stagner",         "Caleb",   "Adsm",             "5975 Butler Street",          "Las Vegas",      "NV", "89149", "(702) 379-2150", "Completed", "872082532000", "2026-05-20"],
  ["Gail Detolla",          "Lindsey", "Council Pay",      "405 Brenot Court",            "Blissfield",     "MI", "49228", "(248) 755-5050", "Completed", "872082532950", "2026-05-20"],
  ["James Detolla",         "Lindsey", "Council Pay",      "405 Brenot Court",            "Blissfield",     "MI", "49228", "(248) 755-5050", "Completed", "872082532011", "2026-05-20"],
  ["Vicky Blasi",           "Marissa", "Council Pay",      "715 Wheatland Street",        "Colwich",        "KS", "67030", "(316) 650-4336", "Completed", "872082532066", "2026-05-20"],
  ["Diane Radtke",          "Maya",    "Council Pay",      "1044 Fond Du Lac Avenue",     "Kewaskum",       "WI", "53040", "(262) 339-3057", "Completed", "872082532905", "2026-05-20"],
  ["Richard Radtke",        "Maya",    "Council Pay",      "1044 Fond Du Lac Avenue",     "Kewaskum",       "WI", "53040", "(262) 339-3057", "Completed", "872082532364", "2026-05-20"],
  ["Jim Dougherty",         "Marissa", "Council Pay",      "2636 Southwest 66th Street",  "Oklahoma City",  "OK", "73159", "(405) 549-2807", "Completed", "872082532592", "2026-05-20"],
  ["Stephanie Mahnken",     "Maya",    "Council Pay",      "3399 County Road 328",        "Fulton",         "MO", "65251", "(573) 590-4488", "Completed", "872082533338", "2026-05-20"],
  ["Bobbi George",          "Maya",    "Council Pay",      "1263 Lancaster Avenue",       "Reynoldsburg",   "OH", "43068", "(614) 313-9333", "Completed", "872082530751", "2026-05-20"],
  ["Odette Ferguson",       "Lindsey", "Council Pay",      "11000 Sterling Street",       "Romulus",        "MI", "48174", "(734) 740-8651", "Completed", "872082533110", "2026-05-20"],
  ["Shawn Ferguson",        "Lindsey", "Council Pay",      "11000 Sterling Street",       "Romulus",        "MI", "48174", "(734) 740-8651", "Completed", "872082531519", "2026-05-20"],
  ["Neomia Clark",          "Marissa", "Council Pay",      "105 Dawson Road",             "Eufaula",        "OK", "74432", "(918) 689-0317", "Completed", "872082532798", "2026-05-20"],
  ["Albert Palmieri",       "Caleb",   "Horizon",          "566 McNeil Road",             "Louisville",     "MS", "39339", "(662) 803-2343", "Completed", "872082532320", "2026-05-20"],
  ["Linda Cole",            "Bobby",   "Assurant",         "2069 Bromford Road",          "Maumee",         "OH", "43537", "(419) 490-8387", "Completed", "872082532960", "2026-05-20"],
  ["Jacqueline Maerkisch",  "Maya",    "Council Pay",      "112 State Route 61",          "Norwalk",        "OH", "44857", "(419) 577-7150", "Completed", "872082531574", "2026-05-20"],
  ["Antoinette Lorenz",     "Caleb",   "Council Pay",      "6636 Pheasant Run Circle",    "Riverside",      "CA", "92509", "(951) 227-9384", "Completed", "872082531493", "2026-05-20"],
  ["Suzanna Morgan",        "Lindsey", "Progressive",      "6485 Whiteford Road",         "Ottawa Lake",    "MI", "49267", "(734) 368-8812", "Completed", "872082530534", "2026-05-20"],
  ["John Morgan",           "Lindsey", "Progressive",      "6485 Whiteford Road",         "Ottawa Lake",    "MI", "49267", "(734) 368-8812", "Completed", "872082534172", "2026-05-20"],
  ["Cheryl Cullen",         "Marissa", "Council Pay",      "1021 Culmer Drive",           "Virginia Beach", "VA", "23454", "(757) 647-0620", "Completed", "872082532240", "2026-05-20"],
  ["Kimberly Harrington",   "Maya",    "Progressive",      "1825 7th Street",             "Columbia City",  "OR", "97018", "(503) 396-1447", "Completed", "872082533084", "2026-05-20"],

  // ── May 17 batch ──────────────────────────────────────────────────────────
  ["Michael Mcguire",       "Bobby",   "Council Pay",      "60 Glade Road",               "East Hampton",   "NY", "11937", "(516) 848-2555", "Completed", "871902567407", "2026-05-17"],
  ["Greg Willey",           "Lindsey", "Horizon",          "806 Southeast Oak Drive",     "Ankeny",         "IA", "50021", "(515) 554-1958", "Completed", "871902567819", "2026-05-17"],
  ["David Ondrey",          "Maya",    "Council Pay",      "512 Twisted Oak Lane",        "Crawford",       "TX", "76638", "(817) 455-3433", "Completed", "871902567039", "2026-05-17"],
  ["Beecher Adkins",        "Caleb",   "Council Pay",      "5011 South 134th Street",     "Omaha",          "NE", "68137", "(402) 201-4996", "Completed", "871902567521", "2026-05-17"],
  ["Juanita Adkins",        "Caleb",   "Council Pay",      "5011 South 134th Street",     "Omaha",          "NE", "68137", "(402) 201-4996", "Completed", "871902567613", "2026-05-17"],
  ["Marie Kleinman",        "Marissa", "New Life",         "18342 Delano Street",         "Los Angeles",    "CA", "91335", "(818) 456-7359", "Completed", "871902566433", "2026-05-17"],
  ["Kathleen Taylor",       "Marissa", "Council Pay",      "1301 Calaveras Drive",        "Carson City",    "NV", "89703", "(775) 721-1275", "Completed", "871902566742", "2026-05-17"],
  ["Rebecca West",          "Marissa", "Council Pay",      "601 Oak Avenue",              "Rockport",       "TX", "78382", "(406) 249-2333", "Completed", "871902567510", "2026-05-17"],
  ["Robert George",         "Maya",    "Horizon",          "223 Carriage Drive",          "Middlebury",     "CT", "06762", "(203) 758-2301", "Completed", "871902566845", "2026-05-17"],
  ["Douglas Brown",         "Caleb",   "Council Pay",      "609 Oriole Drive",            "Springdale",     "AR", "72762", "(479) 544-4781", "Completed", "871902564897", "2026-05-17"],
  ["Jackie Robinson",       "Lindsey", "Horizon",          "1202 Melody Circle",          "Kaufman",        "TX", "75142", "(214) 505-5995", "Completed", "871902567418", "2026-05-17"],
  ["Ruth Gaynor",           "Marissa", "Council Pay",      "1003 Southwest 5th Avenue",   "Boynton Beach",  "FL", "33426", "(561) 859-5101", "Completed", "871902567223", "2026-05-17"],
  ["Suzanne Wun",           "Caleb",   "Assurant",         "1510 North Pass Avenue",      "Burbank",        "CA", "91505", "(818) 335-1074", "Completed", "871902566753", "2026-05-17"],
  ["Ida Mcclendon",         "Marissa", "Horizon",          "4140 Northeast Holman Street","Portland",       "OR", "97211", "(503) 282-0724", "Completed", "871902566422", "2026-05-17"],
  ["Darlene Sepulveda",     "Maya",    "Council Pay",      "1141 Big Canyon Drive",       "San Bernardino", "CA", "92407", "(909) 754-6511", "Completed", "871902567716", "2026-05-17"],
  ["Scott Rasmussen",       "Caleb",   "Council Pay",      "53900 Avenida Diaz",          "La Quinta",      "CA", "92253", "(760) 534-3071", "Completed", "871902567142", "2026-05-17"],
  ["Carol Murray",          "Bobby",   "Horizon",          "4943 Southwest Chestnut Place","Beaverton",     "OR", "97005", "(503) 929-6590", "Completed", "871902566775", "2026-05-17"],
  ["Melissa Wallace",       "Bobby",   "Council Pay",      "904 Hanes Boulevard",         "Hughes Springs", "TX", "75656", "(903) 918-4531", "Completed", "871902566764", "2026-05-17"],
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseName(full) {
  const parts = full.trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ");
  return { first, last };
}

async function lookupClientId(firstName, lastName) {
  const { data } = await supabase
    .from("clients")
    .select("id, first_name, last_name, spouse_first_name, spouse_last_name")
    .or(
      `and(first_name.ilike.${firstName},last_name.ilike.${lastName}),` +
      `and(spouse_first_name.ilike.${firstName},spouse_last_name.ilike.${lastName})`
    )
    .limit(1);
  return data?.[0]?.id ?? null;
}

// ── Step 1: Delete existing May 25 rows (stale/incomplete data) ───────────────
console.log("Step 1: Clearing existing May 25 batch (replacing with complete data)…");
const { error: deleteErr } = await supabase
  .from("client_fedex_shipments")
  .delete()
  .eq("batch_id", "2026-05-25");

if (deleteErr) console.error("  Delete error:", deleteErr.message);
else console.log("  Done.");

// ── Step 2: Build upsert rows ─────────────────────────────────────────────────
console.log("\nStep 2: Building rows and looking up client IDs…");

const rows = [];
for (const [name, advisor, merchant, street, city, state, zip, phone, status, tracking, dateAdded] of RAW) {
  const { first, last } = parseName(name);
  const clientId = await lookupClientId(first, last);
  if (!clientId) {
    console.warn(`  ⚠ No client match for: ${name}`);
  }
  rows.push({
    recipient_name: name.trim(),
    recipient_type: "primary",
    carrier: "fedex",
    advisor,
    merchant,
    street_address: street.trim(),
    city: city.trim(),
    state: state.trim(),
    zip_code: zip.trim(),
    phone: phone.trim(),
    status,
    tracking_number: tracking.trim(),
    batch_id: dateAdded,
    batch_date: dateAdded,
    sent_at: `${dateAdded}T12:00:00+00:00`,
    delivered_at: null,
    client_id: clientId,
  });
}

console.log(`  Built ${rows.length} rows (${rows.filter(r => r.client_id).length} with matched client IDs).`);

// ── Step 3: Skip May 17 rows (already correct in DB), insert May 20 + 25 ──────
const rowsToInsert = rows.filter(r => r.batch_id !== "2026-05-17");
console.log(`\nStep 3: Inserting ${rowsToInsert.length} rows (May 20 + May 25 batches)…`);

const BATCH = 50;
let inserted = 0;
let errors = 0;
for (let i = 0; i < rowsToInsert.length; i += BATCH) {
  const chunk = rowsToInsert.slice(i, i + BATCH);
  const { error } = await supabase
    .from("client_fedex_shipments")
    .insert(chunk);
  if (error) {
    console.error(`  Batch ${i}-${i + chunk.length} error:`, error.message);
    errors += chunk.length;
  } else {
    inserted += chunk.length;
  }
}

console.log(`\n✓ Upserted ${inserted} rows (${errors} errors).`);
console.log("\nTab breakdown:");
console.log("  Packets Sent      → May 25 batch (18 rows, status: Completed)");
console.log("  Packets Delivered → May 20 batch (34 rows, status: Completed)");
console.log("  Archive           → May 17 and all earlier batches");
