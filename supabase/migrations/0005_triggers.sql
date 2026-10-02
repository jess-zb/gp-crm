-- Triggers
--
-- Golden Pathway baseline. Generated once from a verified database, then
-- maintained by hand. See docs/golden-pathway-plan.md section 7.4.
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER comm_templates_updated_at BEFORE UPDATE ON public.comm_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER esign_requests_updated_at BEFORE UPDATE ON public.esign_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER on_client_created AFTER INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION public.create_default_checklist();

CREATE TRIGGER on_collection_letter_upload AFTER INSERT ON public.documents FOR EACH ROW EXECUTE FUNCTION public.handle_collection_letter_upload();

CREATE TRIGGER on_poa_upload AFTER INSERT ON public.documents FOR EACH ROW EXECUTE FUNCTION public.handle_poa_upload();

CREATE TRIGGER onboarding_checklist_set_item_key_trg BEFORE INSERT ON public.onboarding_checklist FOR EACH ROW EXECUTE FUNCTION public.onboarding_checklist_set_item_key();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER refunds_updated_at BEFORE UPDATE ON public.refunds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_cancel_enrollments_on_client_inactive AFTER UPDATE OF is_active ON public.clients FOR EACH ROW EXECUTE FUNCTION public.cancel_enrollments_on_client_inactive();

CREATE TRIGGER trg_client_stage_change AFTER INSERT OR UPDATE OF stage ON public.clients FOR EACH ROW EXECUTE FUNCTION public.handle_client_stage_change();

CREATE TRIGGER trg_log_template_change AFTER UPDATE ON public.email_message_templates FOR EACH ROW EXECUTE FUNCTION public.log_template_change();
