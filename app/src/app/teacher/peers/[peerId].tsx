import { useLocalSearchParams } from 'expo-router';
import { usePeerForm, useSubmitPeer } from '@/api/hooks';
import { EvaluationFlow } from '@/components/EvaluationFlow';
import { tr } from '@/lib/i18n';

/** A teacher evaluating a colleague who teaches the same subject. */
export default function PeerEvaluateScreen() {
  const { peerId } = useLocalSearchParams<{ peerId: string }>();
  const id = Number(peerId);
  const form = usePeerForm(id);
  const submit = useSubmitPeer();
  const d = form.data;

  return (
    <EvaluationFlow
      form={d && { ...d, subtitle: [tr('Peer evaluation', 'Peer evaluation'), d.period?.name].filter(Boolean).join(' · ') }}
      loading={form.isLoading}
      error={form.error}
      onRetry={() => form.refetch()}
      draftKey={`peer-${id}`}
      homeHref="/teacher"
      submitting={submit.isPending}
      submitError={submit.error}
      onSubmit={(a, onSuccess) => submit.mutate({ teacher_id: id, ...a }, { onSuccess })}
    />
  );
}
