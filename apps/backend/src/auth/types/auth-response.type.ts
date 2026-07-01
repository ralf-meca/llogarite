export type AuthResponse = {
    accessToken: string;
    user: {
        id: string;
        email: string;
    };
};
