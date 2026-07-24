import type { QueryKey } from "@tanstack/react-query";
import { consoleApiClient } from "./consoleApiClient";
import { queryClient } from "./queryClient";
import type { LiveUpdatePayload } from "./socket";
import type { ThingDesignMember, ThingDesignResult } from "../types/consoleApi";

let installed = false;

interface RuntimeMemberUpdate {
  sourceName: string;
  name: string;
  value: unknown;
}

function normaliseUName(uName: string): string {
  const trimmed = uName.trim();
  return trimmed.startsWith(":") ? trimmed : `:${trimmed}`;
}

function isDescribeThingQuery(queryKey: QueryKey): boolean {
  return queryKey[0] === "describeThing";
}

function isRuntimeMemberUpdate(payload: LiveUpdatePayload): payload is LiveUpdatePayload & { data: RuntimeMemberUpdate } {
  return typeof payload.data?.sourceName === "string" &&
    typeof payload.data?.name === "string" &&
    Object.prototype.hasOwnProperty.call(payload.data, "value");
}

function memberMatches(member: ThingDesignMember, thingUName: string, update: RuntimeMemberUpdate): boolean {
  const sourceName = normaliseUName(update.sourceName);
  const memberUName = normaliseUName(member.uName);
  const expectedMemberUName = `${sourceName}:${update.name}`;

  return memberUName === expectedMemberUName ||
    (normaliseUName(thingUName) === sourceName && member.name === update.name);
}

function updateMembers(
  members: ThingDesignMember[],
  thingUName: string,
  update: RuntimeMemberUpdate
): { members: ThingDesignMember[]; changed: boolean } {
  var changed = false;
  const nextMembers = members.map((member) => {
    if (!memberMatches(member, thingUName, update) || Object.is(member.value, update.value)) {
      return member;
    }

    changed = true;
    return {
      ...member,
      value: update.value
    };
  });

  return {
    members: changed ? nextMembers : members,
    changed
  };
}

function updateThingDesignMembers(
  result: ThingDesignResult,
  section: "properties" | "events",
  update: RuntimeMemberUpdate
): ThingDesignResult {
  const thingUName = result.thing.object.uName;
  const topLevelMembers = updateMembers(result[section], thingUName, update);
  const localMembers = updateMembers(result.inheritance[section].local, thingUName, update);
  const parentMembers = updateMembers(result.inheritance[section].parent, thingUName, update);
  const childMembers = updateMembers(result.inheritance[section].child, thingUName, update);

  if (!topLevelMembers.changed && !localMembers.changed && !parentMembers.changed && !childMembers.changed) {
    return result;
  }

  return {
    ...result,
    [section]: topLevelMembers.members,
    inheritance: {
      ...result.inheritance,
      [section]: {
        ...result.inheritance[section],
        local: localMembers.members,
        parent: parentMembers.members,
        child: childMembers.members
      }
    }
  };
}

function patchDescribeThingCaches(section: "properties" | "events", update: RuntimeMemberUpdate): void {
  queryClient.setQueriesData<ThingDesignResult>(
    {
      predicate: (query) => isDescribeThingQuery(query.queryKey)
    },
    (current) => {
      if (!current) {
        return current;
      }

      return updateThingDesignMembers(current, section, update);
    }
  );
}

function handleLiveUpdate(payload: LiveUpdatePayload): void {
  if (!isRuntimeMemberUpdate(payload)) {
    return;
  }

  if (payload.type === "source-property-changed") {
    patchDescribeThingCaches("properties", payload.data);
  }
  else if (payload.type === "source-event-raised") {
    patchDescribeThingCaches("events", payload.data);
  }
}

export function installLiveUpdates(): void {
  if (installed) {
    return;
  }

  installed = true;
  consoleApiClient.onLiveUpdate(handleLiveUpdate);
}
