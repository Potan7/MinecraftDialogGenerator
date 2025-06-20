
using System;
using Dialog.ActionComponent;

namespace Dialog.DialogType
{
    [Serializable]
    public class NoticeDialog : DialogTypeMain
    {

        public ActionButton action;

        NoticeDialog() : base("notice")
        {
            // 기본 생성자에서 타입을 "notice"로 설정
        }
    }
}