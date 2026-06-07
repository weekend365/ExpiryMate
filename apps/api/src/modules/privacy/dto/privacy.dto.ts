import { Equals } from "class-validator";

export class DeleteAccountDto {
  @Equals("삭제", { message: "삭제 확인 문구가 올바르지 않습니다." })
  confirmation!: "삭제";
}
