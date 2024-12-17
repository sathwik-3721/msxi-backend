import axios from "axios";
import fs from "fs";
import { accessSecretVersion } from "../GCP/access-secret";

const BEGIN_KEY = "-----BEGIN RSA PUBLIC KEY-----\n";
const END_KEY = "\n-----END RSA PUBLIC KEY-----\n";

export const savePublicKey = async () => {
  const config = {
    url: `${await accessSecretVersion(
      "KEYCLOAK_ACCESS_URL"
    )}/realms/${await accessSecretVersion(
      "KEYCLOAK_REALM"
    )}/protocol/openid-connect/certs`,
    method: "GET",
  };

  axios(config)
    .then((res) => {
      const keys = res.data.keys;
      const rsaKey = keys.find(
        (key) => key.kty === "RSA" && key.alg === "RS256"
      );

      const mod = convertToHex(rsaKey.n);
      const exp = convertToHex(rsaKey.e);

      const encModLen = encodeLength(mod.length / 2);
      const encExpLen = encodeLength(exp.length / 2);
      const part = [mod, exp, encModLen, encExpLen]
        .map((n) => n.length / 2)
        .reduce((a, b) => a + b);
      const bufferSource = `30${encodeLength(
        part + 2
      )}02${encModLen}${mod}02${encExpLen}${exp}`;
      const pubkey = Buffer.from(bufferSource, "hex").toString("base64");
      const publicKey =
        BEGIN_KEY + pubkey.match(/.{1,64}/g).join("\n") + END_KEY;

      fs.writeFileSync("public.pem", publicKey);

      console.log("Public key saved successfully");
    })
    .catch((err) => {
      console.error("Error fetching public key from keycloak: ", err.message);
      throw err;
    });

  function convertToHex(str) {
    const hex = Buffer.from(str, "base64").toString("hex");
    return hex[0] < "0" || hex[0] > "7" ? `00${hex}` : hex;
  }

  function encodeLength(n) {
    return n <= 127 ? toHex(n) : toLongHex(n);
  }

  function toLongHex(number) {
    const str = toHex(number);
    const lengthByteLength = 128 + str.length / 2;
    return toHex(lengthByteLength) + str;
  }

  function toHex(number) {
    const str = number.toString(16);
    return str.length % 2 ? `0${str}` : str;
  }
};
