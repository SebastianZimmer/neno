import { Filepath } from "./Filepath";
import User from "./User";

export default interface AppStartOptions {
    users: User[],
    dataPath: Filepath,
    frontendPath: Filepath,
    jwtSecret: string,
}