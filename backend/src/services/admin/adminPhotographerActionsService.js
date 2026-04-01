import { prisma } from "../../config/prisma.js";

export const adminPhotographerActionsService = {
  async setPhotographerStatus(id, status) {
    const nextStatus = status === "active" ? "ACTIVE" : "SUSPENDED";
    const updated = await prisma.user.update({
      where: { id },
      data: { status: nextStatus },
    });

    await prisma.notification.create({
      data: {
        userId: updated.id,
        type: "ADMIN",
        title: nextStatus === "ACTIVE" ? "Account reactivated" : "Account suspended",
        body:
          nextStatus === "ACTIVE"
            ? "Your account access has been restored by the admin team."
            : "Your account has been suspended by the admin team.",
        actionUrl: "/dashboard/settings",
      },
    });

    return {
      id: updated.id,
      status: updated.status.toLowerCase(),
    };
  },
};

