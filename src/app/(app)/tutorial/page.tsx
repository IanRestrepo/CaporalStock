import { requireUser } from "@/lib/session";
import { Tutorial } from "./tutorial";

export const metadata = { title: "Cómo funciona" };

export default async function TutorialPage({ searchParams }: PageProps<"/tutorial"> ) {
  const user = await requireUser();
  const params = await searchParams;
  const step = Number(typeof params.paso === "string" ? params.paso : 1);

  return (
    <Tutorial
      role={user.role}
      name={user.name.split(" ")[0]}
      start={Number.isFinite(step) && step > 0 ? step : 1}
    />
  );
}
