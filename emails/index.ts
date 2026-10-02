import WelcomeLead from "./welcome-lead";
import WelcomeCs from "./welcome-cs";
import FollowUp24hr from "./follow-up-24hr";
import Active1 from "./active-1";
import Active2 from "./active-2";
import Active3 from "./active-3";
import Active4 from "./active-4";
import Active5 from "./active-5";
import Active6 from "./active-6";
import Active7 from "./active-7";
import Partial1 from "./partial-1";
import Partial2 from "./partial-2";
import Partial3 from "./partial-3";
import Partial4 from "./partial-4";
import CaseReferred from "./case-referred";
import Holiday from "./holiday";

export const templateRegistry = {
  welcome_lead: WelcomeLead,
  welcome_cs: WelcomeCs,
  follow_up_24hr: FollowUp24hr,
  active_1: Active1,
  active_2: Active2,
  active_3: Active3,
  active_4: Active4,
  active_5: Active5,
  active_6: Active6,
  active_7: Active7,
  partial_1: Partial1,
  partial_2: Partial2,
  partial_3: Partial3,
  partial_4: Partial4,
  case_referred: CaseReferred,
  holiday: Holiday,
} as const;

export type TemplateKey = keyof typeof templateRegistry;

