export interface AuthResponseDto {
    user: {
        id: string;
        email: string;
        name: string | null;
    };
    accessToken: string;
}
