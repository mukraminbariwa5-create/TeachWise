import { useLocalSearchParams } from 'expo-router';
import { useEvaluationForm, useSubmitEvaluation } from '@/api/hooks';
import { EvaluationFlow } from '@/components/EvaluationFlow';

/** A student evaluating one teacher for one class. */
export default function EvaluateScreen() {
  const { offeringId } = useLocalSearchParams<{ offeringId: string }>();
  const id = Number(offeringId);
  const form = useEvaluationForm(id);
  const submit = useSubmitEvaluation();
  const d = form.data;

  return (
    <EvaluationFlow
      form={d && { ...d, subtitle: [d.offering.subject.code, d.offering.subject.name, d.period?.name].filter(Boolean).join(' · ') }}
      loading={form.isLoading}
      error={form.error}
      onRetry={() => form.refetch()}
      draftKey={id}
      homeHref="/student"
      submitting={submit.isPending}
      submitError={submit.error}
      onSubmit={(a, onSuccess) => submit.mutate({ class_offering_id: id, ...a }, { onSuccess })}
    />
  );
}
