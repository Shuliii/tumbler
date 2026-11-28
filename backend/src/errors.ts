/** An error whose message is safe to show to the customer. */
export class UserFacingError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
