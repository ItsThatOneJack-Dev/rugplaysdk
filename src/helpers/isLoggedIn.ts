import User from "../classes/User";

export async function isLoggedIn(): Promise<boolean> {
    return !!(await User.me());
}
