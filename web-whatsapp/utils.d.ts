declare function sleep(ms: number): Promise<void>;
declare function randomInt(min: number, max: number): number;
declare class AuthPauseError extends Error {
}
declare function isAuthError(err: any): boolean;
declare function isDisconnectError(err: any): boolean;
export { sleep, randomInt, AuthPauseError, isAuthError, isDisconnectError };
