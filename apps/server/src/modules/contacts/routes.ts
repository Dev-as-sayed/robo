import { Router } from "express";
import { createContactSchema } from "@robo/shared/schemas";
import { createContact, deleteContact, getContacts } from "@robo/shared/contacts";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";

const router = Router();

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const contacts = await getContacts(req.user!.id);
    sendSuccess(res, { code: "CONTACTS_FETCHED", data: { contacts } });
  })
);

router.post(
  "/",
  authenticate,
  validate({ body: createContactSchema }),
  asyncHandler(async (req, res) => {
    const contact = await createContact(req.user!.id, req.body);
    sendSuccess(res, {
      status: 201,
      code: "CONTACT_CREATED",
      message: "Contact created successfully",
      data: { contact },
    });
  })
);

router.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    await deleteContact(req.user!.id, req.params.id);
    sendSuccess(res, { code: "CONTACT_DELETED", message: "Contact deleted successfully" });
  })
);

export default router;
