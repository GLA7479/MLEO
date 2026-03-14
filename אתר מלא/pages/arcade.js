const ARCADE_TARGET = "https://mleo-m.vercel.app/mining?lang=en";

export async function getServerSideProps() {
  return {
    redirect: {
      destination: ARCADE_TARGET,
      permanent: false,
    },
  };
}

export default function ArcadeRedirect() {
  return null;
}
