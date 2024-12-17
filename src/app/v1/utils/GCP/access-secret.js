import  { SecretManagerServiceClient } from ('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();
export async function accessSecretVersion(secretName) {

    // the only environment variables needed should be GCP_PROJECT_ID and ENVIRONMENT
    // ENVIRONMENT should be set to "dev", "staging", or "prod"
    // then the secret will be found accordingly
    // example: if ENVIRONMENT is "dev" and secretName is "keycloak", the secret will be found at "DEV_KEYCLOAK"
    // example: if ENVIRONMENT is "prod" and secretName is "keycloak", the secret will be found at "PROD_KEYCLOAK
    const versions = await client.accessSecretVersion({
        name:  `projects/${process.env.GCP_PROJECT_ID}/secrets/${process.env.ENVIRONMENT.toUpperCase() + "_" + secretName}/versions/latest`,
    });

    const version = versions[0]; // return most recent version

    const secret = version.payload.data.toString('utf8')

    return secret;
}

