export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "bad_request",
  ) {
    super(message);
  }
}
export const forbidden = (m = "Tidak punya akses") => new AppError(m, 403, "forbidden");
export const notFound = (m = "Data tidak ditemukan") => new AppError(m, 404, "not_found");
export const unauthorized = (m = "Belum login") => new AppError(m, 401, "unauthorized");
