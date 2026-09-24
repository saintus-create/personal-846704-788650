import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";
import type { AuthFn } from "eve/channels/auth";
import { getSetupStatus } from "@/lib/setup";

/** Public-site auth: anyone gets a stable public principal. */
const openEveAuth: AuthFn<Request> = async () => {
  const status = await getSetupStatus();
  if (status.authMode !== "open") return null;
  return {
    attributes: { name: "public visitor" },
    authenticator: "open",
    issuer: "california-legislative-information",
    principalId: "public",
    principalType: "user",
    subject: "public",
  };
};

export default eveChannel({
  auth: [openEveAuth, vercelOidc(), localDev()],
  uploadPolicy: "disabled",
});
