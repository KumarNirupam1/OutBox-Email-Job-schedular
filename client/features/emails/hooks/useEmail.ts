import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { emailApi } from "../api/email";
import { SchedulePayload } from "@/lib/types";

export function useScheduledEmails() {
  return useQuery({
    queryKey: ["emails", "scheduled"],
    queryFn: emailApi.getScheduled,
  });
}

export function useSentEmails() {
  return useQuery({
    queryKey: ["emails", "sent"],
    queryFn: emailApi.getSent,
  });
}

export function useScheduleEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SchedulePayload) => emailApi.schedule(data),
    onSuccess: () => {
      // Automatically refetch the scheduled list when a new email is scheduled
      queryClient.invalidateQueries({ queryKey: ["emails", "scheduled"] });
    },
  });
}