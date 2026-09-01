export interface ApiResponseDto<T> {
    data: T;
    meta?: any;
}
export interface ApiErrorResponseDto {
    statusCode: number;
    message: string | string[];
    error: string;
    timestamp: string;
    path: string;
}
