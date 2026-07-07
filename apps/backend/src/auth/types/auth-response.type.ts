export type AuthResponse = {
    accessToken: string;
    user: {
        id: string;
        email: string;
        hasPassword: boolean;
        name: string | null;
        avatarUrl: string | null;
        isPremium: boolean;
    };
};
