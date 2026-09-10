const CHECK_TIMEOUT_MS = 6000;
const MAX_TEXT_LENGTH = 240;

class MedicineBoxServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function safeText(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, MAX_TEXT_LENGTH) : null;
}

function toSafeStatus(value) {
  if (typeof value === "boolean") return value ? "AVAILABLE" : "UNAVAILABLE";
  const normalized = safeText(value)?.toUpperCase();
  if (["AVAILABLE", "IN_STOCK", "OPEN", "YES"].includes(normalized)) return "AVAILABLE";
  if (["UNAVAILABLE", "OUT_OF_STOCK", "CLOSED", "NO"].includes(normalized)) return "UNAVAILABLE";
  return "UNKNOWN";
}

function getConfiguration(overrides = {}) {
  const baseUrl = overrides.baseUrl ?? process.env.MEDICINE_BOX_API_BASE_URL;
  const apiKey = overrides.apiKey ?? process.env.MEDICINE_BOX_API_KEY;
  const path = overrides.path ?? process.env.MEDICINE_BOX_API_PATH ?? "/api/peer/clinic/medicines/availability";

  if (!baseUrl || !apiKey) {
    throw new MedicineBoxServiceError(
      "MEDICINE_BOX_NOT_CONFIGURED",
      "Medicine Box integration is not configured."
    );
  }

  let origin;
  try {
    origin = new URL(baseUrl);
  } catch {
    throw new MedicineBoxServiceError(
      "MEDICINE_BOX_NOT_CONFIGURED",
      "Medicine Box integration is not configured."
    );
  }

  if (!["http:", "https:"].includes(origin.protocol) || !path.startsWith("/")) {
    throw new MedicineBoxServiceError(
      "MEDICINE_BOX_NOT_CONFIGURED",
      "Medicine Box integration is not configured."
    );
  }

  return { baseUrl: origin, apiKey, path };
}

function toClinicCategory(categoryName) {
  const category = safeText(categoryName);
  if (!category) return "First-Aid";

  const normalized = category.toLowerCase().replace(/[\s_]+/g, "-");
  if (["first-aid", "firstaid", "medical", "medicine", "medical-kit"].includes(normalized)) {
    return "First-Aid";
  }
  return category;
}

function createRequestUrl(item, configuration) {
  const url = new URL(configuration.path, configuration.baseUrl);
  // The agreed Clinic API currently accepts the category filter only.
  url.searchParams.set("category", toClinicCategory(item.category?.name));
  return url;
}

function readField(value, names) {
  for (const name of names) {
    if (Object.hasOwn(value, name)) return value[name];
  }
  return undefined;
}

function toDisplayText(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return safeText(value);
}

function toSafeResult(payload) {
  const data = payload && typeof payload === "object" && payload.data && typeof payload.data === "object"
    ? payload.data
    : payload;
  const value = Array.isArray(data)
    ? data[0] || {}
    : Array.isArray(data?.medicines)
      ? data.medicines[0] || {}
      : data && typeof data === "object"
        ? data
        : {};

  const medicineName = toDisplayText(readField(value, ["medicineName", "medicine_name", "medicine name", "name"]));
  const quantity = toDisplayText(readField(value, ["quantity"]));
  const unit = toDisplayText(readField(value, ["unit"]));
  const stockStatus = toDisplayText(readField(value, ["stockStatus", "stock_status", "stock status"]));
  const expiryStatus = toDisplayText(readField(value, ["expiryStatus", "expiry_status", "expiry status"]));
  const partnerMessage = safeText(readField(value, ["message", "summary"]));
  const details = [
    medicineName && `Medicine: ${medicineName}`,
    quantity && `Quantity: ${quantity}${unit ? ` ${unit}` : ""}`,
    stockStatus && `Stock: ${stockStatus}`,
    expiryStatus && `Expiry: ${expiryStatus}`,
    partnerMessage
  ].filter(Boolean);

  return {
    status: toSafeStatus(readField(value, ["availabilityStatus", "availability_status", "availability status", "available", "availability", "status"])),
    supportLocation: safeText(readField(value, ["supportLocation", "support_location", "medicineBoxLocation", "location"])),
    message: details.length ? details.join(" · ").slice(0, MAX_TEXT_LENGTH) : null
  };
}

async function checkMedicineBoxAvailability(item, options = {}) {
  const configuration = getConfiguration(options);
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? CHECK_TIMEOUT_MS);

  try {
    const response = await fetchImpl(createRequestUrl(item, configuration), {
      headers: {
        Accept: "application/json",
        "x-api-key": configuration.apiKey
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new MedicineBoxServiceError(
        "MEDICINE_BOX_UNAVAILABLE",
        "Medicine Box service is temporarily unavailable."
      );
    }

    const payload = await response.json();
    return toSafeResult(payload);
  } catch (error) {
    if (error instanceof MedicineBoxServiceError) throw error;
    if (error?.name === "AbortError") {
      throw new MedicineBoxServiceError(
        "MEDICINE_BOX_TIMEOUT",
        "Medicine Box service timed out."
      );
    }
    throw new MedicineBoxServiceError(
      "MEDICINE_BOX_UNAVAILABLE",
      "Medicine Box service is temporarily unavailable."
    );
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  MedicineBoxServiceError,
  checkMedicineBoxAvailability,
  createRequestUrl,
  toClinicCategory,
  toSafeResult
};
