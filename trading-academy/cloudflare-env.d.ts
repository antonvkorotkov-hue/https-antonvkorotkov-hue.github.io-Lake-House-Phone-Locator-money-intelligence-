declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    MARKETDATA_API_KEY?: string;
    MARKETDATA_LICENSE_CONFIRMED?: string;
    MARKETDATA_REALTIME_CONFIRMED?: string;
    MARKETDATA_OPTIONS_LICENSE_CONFIRMED?: string;
    OWNER_EMAIL?: string;
    CREDENTIAL_ENCRYPTION_KEY?: string;
    BUCKET?: R2Bucket;
  }
}
