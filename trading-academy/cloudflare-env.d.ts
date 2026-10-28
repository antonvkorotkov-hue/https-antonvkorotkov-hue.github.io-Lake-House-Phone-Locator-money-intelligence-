declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    MARKETDATA_API_KEY?: string;
    MARKETDATA_LICENSE_CONFIRMED?: string;
    MARKETDATA_REALTIME_CONFIRMED?: string;
    BUCKET?: R2Bucket;
  }
}
