import {IUnitOfWork} from "../../Application/Persistences/IRepositories/IUnitOfWork";
import {UnitOfWork} from "../../Infrastructure/Persistences/Respositories/UnitOfWork";

/**
 * Middleware function to check if the user has the required permissions.
 *
 * @param bitwisePermission - The required permission in bitwise format.
 * @returns - The response object.
 */
export function hasPermission(bitwisePermission: number) {
    return async (req: any, res: any, next: any) => {
        console.log("BitwisePermission: ", bitwisePermission);

        const unitOfWork: IUnitOfWork = new UnitOfWork();
        try {
            //get RoleId from req.user
            const user = req.user;
            if (user == null) {
                res.status(401).send("Unauthorized");
            }
            // console.log("User: ", user);
            const query = {
                isActive: true,
                isDeleted: false,
            }

            const currentUser = await unitOfWork.userRepository.getUserById(user.userId, query);
            // console.log("Current User: ", currentUser);

            const roleId = currentUser.roleId;
            // console.log("Role Id: ", roleId);

            const role: any = await unitOfWork.roleRepository.getRoleById(roleId, query);
            // console.log("Role: ", role);

            if (role == null) {
                return res.status(500).send("Internal Server Error");
            }

            console.log("Role Permission: ", role.bitwisePermission);
            console.log("Bitwise Permission: ", bitwisePermission);
            if ((role.bitwisePermission & bitwisePermission) === 0) {
                return res.status(403).send("You dont have permission to access this route");
            }

            next();
        } catch (error: any) {
            return res.status(500).json({error: `Error occured at check permission middleware: ${error.message}`})
        }
    }
}