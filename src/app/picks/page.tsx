import PicksClient from "./PicksClient";

/**
 * Static import — dynamic() left some phones/desktop on the loading shell forever
 * when the PicksClient chunk failed or stalled. Reliability > code-split here.
 */
export default function PicksPage() {
  return <PicksClient />;
}
