import { toast } from "sonner";

let lastToastTime = 0;
export const showToastWithCooldown = (
  message: string,
  success: boolean,
  cooldown: number = 5000,
) => {
  const currentTime = Date.now();
  if (currentTime - lastToastTime > cooldown) {
    if (success) {
      toast.success(message);
    } else {
      toast.error(message);
    }
    lastToastTime = currentTime;
  }
};
