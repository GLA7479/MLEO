const ARCADE_ONLINE_TARGET = "https://mleo-m.vercel.app/mining?lang=en";

export async function getServerSideProps() {
  return {
    redirect: {
      destination: ARCADE_ONLINE_TARGET,
      permanent: false,
    },
  };
}

export default function ArcadeOnlineRedirect() {
  return null;
}
