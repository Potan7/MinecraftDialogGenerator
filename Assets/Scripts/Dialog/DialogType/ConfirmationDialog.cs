
using System;
using Dialog.ActionComponent;

namespace Dialog.DialogType
{
    [Serializable]
    public class ConfirmationDialog : DialogTypeMain
    {
        public ActionButton yes;
        public ActionButton no;

        public ConfirmationDialog() : base("confirmation")
        {

        }
    }
}