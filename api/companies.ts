type RequestLike = {
  method?: string;
};

type ResponseLike = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

export default function handler(req: RequestLike, res: ResponseLike) {
  if (req.method === "GET") {
    res.status(200).json([]);
    return;
  }

  res.status(501).json({
    error: "This Vercel deployment only serves the static UI. Run the AutoManager server for full API and database support.",
  });
}
