import { useMemo, useState } from "react";

type BearMember = {
  playerId: string;
  playerName: string;
  rallySize: number;
};

type BearGroup = "bear1" | "bear2";

export function useBearRallyOrder(
  bear1Members: BearMember[],
  bear2Members: BearMember[]
) {
  const [hostCount, setHostCount] = useState(15);
  const [rallyOrder, setRallyOrder] = useState("");
  const [selectedBearGroup, setSelectedBearGroup] = useState<BearGroup>("bear1");

  const sortedBear1 = useMemo(
    () => [...bear1Members].sort((a, b) => b.rallySize - a.rallySize),
    [bear1Members]
  );
  const sortedBear2 = useMemo(
    () => [...bear2Members].sort((a, b) => b.rallySize - a.rallySize),
    [bear2Members]
  );

  function generateRallyOrder(bearGroup: BearGroup) {
    const members = bearGroup === "bear1" ? sortedBear1 : sortedBear2;
    const selectedMembers = members.slice(0, hostCount);

    const lines = ["🐻Bear Rally Order🐻"];
    for (let i = 0; i < selectedMembers.length; i += 2) {
      const member1 = selectedMembers[i];
      const member2 = selectedMembers[i + 1];

      const num1 = (i + 1).toString();
      const fullName1 = member1.playerName || member1.playerId;
      const name1 = fullName1.length > 10 ? fullName1.substring(0, 7) + "..." : fullName1;

      if (member2) {
        const num2 = (i + 2).toString();
        const fullName2 = member2.playerName || member2.playerId;
        const name2 =
          fullName2.length > 10 ? fullName2.substring(0, 7) + "..." : fullName2;
        lines.push(`${num1}. ${name1.padEnd(10)} ${num2}. ${name2}`);
      } else {
        lines.push(`${num1}. ${name1}`);
      }
    }

    setRallyOrder(lines.join("\n"));
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(rallyOrder);
  }

  return {
    hostCount,
    setHostCount,
    rallyOrder,
    selectedBearGroup,
    setSelectedBearGroup,
    generateRallyOrder,
    copyToClipboard,
    sortedBear1,
    sortedBear2
  };
}
