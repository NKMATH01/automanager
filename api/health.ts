type ResponseLike = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

export default function handler(_req: unknown, res: ResponseLike) {
  res.status(200).json({
    status: "ok",
    version: "static-vercel",
    deploymentMode: "local_trusted",
    deploymentExposure: "public",
    authReady: true,
    bootstrapStatus: "ready",
    features: {
      companyDeletionEnabled: false,
    },
  });
}
