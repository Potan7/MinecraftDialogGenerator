using System;
using Unity.Cinemachine;
using UnityEngine;
using UnityEngine.InputSystem;

public class CameraMouseController : MonoBehaviour
{
    MainInputSystem inputSystem;

    [SerializeField]
    bool isMouseClicked = false;
    Vector2 mousePosition;

    public float mouseSpeed = 2f;

    public CinemachineCamera cinemachineCamera;
    Camera mainCamera;

    void Start()
    {
        inputSystem = new MainInputSystem();

        inputSystem.UI.Click.performed += OnMouseClicked;

        inputSystem.Enable();

        mainCamera = Camera.main;

    }

    void Update()
    {
        if (isMouseClicked)
        {
            Vector2 mousePos = Mouse.current.position.ReadValue();

            Vector3 diffrence = mousePos - mousePosition;
            mousePosition = mousePos;

            cinemachineCamera.transform.position -= mouseSpeed * Time.deltaTime * diffrence;



            // You can add additional logic here to handle the mouse click in the game world
        }
    }

    private void OnMouseClicked(InputAction.CallbackContext context)
    {
        // if (context.performed)
        // {
        // Debug.Log("Mouse clicked at position: " + Mouse.current.position.ReadValue());
        mousePosition = Mouse.current.position.ReadValue();
        isMouseClicked = true;

        if (Mouse.current.leftButton.wasReleasedThisFrame)
        {
            isMouseClicked = false;
        }
        // }                                                            
    }

    private void OnDestroy()
    {
        inputSystem.UI.Click.performed -= OnMouseClicked;
        inputSystem.Disable();
        inputSystem.Dispose();
    }
}
